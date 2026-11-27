import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  Popup,
  LngLatBounds,
  StyleSpecification,
  GeoJSONSource
} from 'maplibre-gl';

export interface MapMarker {
  id: string | number;
  lng: number;
  lat: number;
  title?: string;
  description?: string;
  popupHtml?: string;
  color?: string;
  label?: string; // Número o texto sobre el pin (ej: '1', '2', '3' para paradas)
  draggable?: boolean;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.html',
  styleUrl: './map.scss'
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() center: [number, number] = [-64.1888, -31.4201]; // [lng, lat]
  @Input() zoom = 12;
  @Input() markers: MapMarker[] = [];
  @Input() routeCoordinates: [number, number][] = []; // [lng, lat][] para trazar ruta de recorrido
  @Input() interactive = true;
  @Input() height = '100%';
  @Input() selectablePoint = false; // Permite hacer click para colocar un pin nuevo (alta cliente)
  @Input() autoFit = true; // Ajusta el zoom para englobar todos los puntos y la ruta

  @Output() markerClick = new EventEmitter<MapMarker>();
  @Output() pointSelect = new EventEmitter<{ lng: number; lat: number }>();
  @Output() mapLoaded = new EventEmitter<MapLibreMap>();

  public map?: MapLibreMap;
  private _markersInstances: MapLibreMarker[] = [];
  private _selectedPointMarker?: MapLibreMarker;
  private _isMapReady = false;

  // Capa base raster OSM libre y sin requerir API keys
  private readonly _defaultStyle: StyleSpecification = {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
      }
    },
    layers: [
      {
        id: 'osm-tiles-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  };

  public ngAfterViewInit(): void {
    this._initMap();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this._isMapReady || !this.map) return;

    if (changes['markers']) {
      this._renderMarkers();
    }

    if (changes['routeCoordinates']) {
      this._renderRoute();
    }

    if (changes['center'] && !changes['center'].firstChange) {
      this.map.flyTo({ center: this.center, zoom: this.zoom });
    }

    if (this.autoFit && (changes['markers'] || changes['routeCoordinates'])) {
      this._fitBounds();
    }
  }

  public ngOnDestroy(): void {
    this._clearMarkers();
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  public resize(): void {
    if (this.map) {
      this.map.resize();
    }
  }

  private _initMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    const map = new MapLibreMap({
      container: this.mapContainer.nativeElement,
      style: this._defaultStyle,
      center: this.center,
      zoom: this.zoom,
      interactive: this.interactive
    });
    this.map = map;

    if (this.interactive) {
      map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
    }

    map.on('load', () => {
      this._isMapReady = true;
      this._initRouteLayer();
      this._renderMarkers();
      this._renderRoute();
      if (this.autoFit) {
        this._fitBounds();
      }
      this.mapLoaded.emit(map);
    });

    map.on('click', (e) => {
      if (this.selectablePoint) {
        const { lng, lat } = e.lngLat;
        this._setSelectablePoint(lng, lat);
        this.pointSelect.emit({ lng, lat });
      }
    });
  }

  private _clearMarkers(): void {
    this._markersInstances.forEach((m) => m.remove());
    this._markersInstances = [];
    if (this._selectedPointMarker) {
      this._selectedPointMarker.remove();
      this._selectedPointMarker = undefined;
    }
  }

  private _renderMarkers(): void {
    if (!this.map || !this._isMapReady) return;

    this._clearMarkers();

    this.markers.forEach((m) => {
      if (m.lng == null || m.lat == null) return;

      const el = document.createElement('div');
      el.className = 'ats-map-marker';
      if (m.color) {
        el.style.backgroundColor = m.color;
      }

      if (m.label) {
        const span = document.createElement('span');
        span.className = 'ats-marker-label';
        span.textContent = m.label;
        el.appendChild(span);
      } else {
        const icon = document.createElement('i');
        icon.className = 'bi bi-geo-alt-fill';
        el.appendChild(icon);
      }

      const marker = new MapLibreMarker({ element: el, draggable: m.draggable ?? false })
        .setLngLat([m.lng, m.lat])
        .addTo(this.map!);

      if (m.title || m.popupHtml) {
        const popupContent =
          m.popupHtml ||
          `<strong>${m.title}</strong>${m.description ? `<p class="mb-0 small">${m.description}</p>` : ''}`;
        const popup = new Popup({ offset: 25 }).setHTML(popupContent);
        marker.setPopup(popup);
      }

      el.addEventListener('click', (evt) => {
        evt.stopPropagation();
        this.markerClick.emit(m);
      });

      if (m.draggable) {
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          this.pointSelect.emit({ lng: lngLat.lng, lat: lngLat.lat });
        });
      }

      this._markersInstances.push(marker);
    });
  }

  private _setSelectablePoint(lng: number, lat: number): void {
    if (!this.map) return;

    if (this._selectedPointMarker) {
      this._selectedPointMarker.setLngLat([lng, lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'ats-map-marker selectable-marker';
      el.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';

      const marker = new MapLibreMarker({
        element: el,
        draggable: true
      })
        .setLngLat([lng, lat])
        .addTo(this.map);
      this._selectedPointMarker = marker;

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        this.pointSelect.emit({ lng: pos.lng, lat: pos.lat });
      });
    }
  }

  private _initRouteLayer(): void {
    if (!this.map || this.map.getSource('route-source')) return;

    this.map.addSource('route-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      }
    });

    this.map.addLayer({
      id: 'route-layer',
      type: 'line',
      source: 'route-source',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#0284c7',
        'line-width': 4,
        'line-opacity': 0.85
      }
    });
  }

  private _renderRoute(): void {
    if (!this.map || !this._isMapReady) return;

    const source = this.map.getSource('route-source') as GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: this.routeCoordinates
        }
      });
    }
  }

  private _fitBounds(): void {
    if (!this.map || !this._isMapReady) return;

    const allPoints: [number, number][] = [];

    this.markers.forEach((m) => {
      if (m.lng != null && m.lat != null) {
        allPoints.push([m.lng, m.lat]);
      }
    });

    this.routeCoordinates.forEach((p) => {
      allPoints.push(p);
    });

    if (allPoints.length === 0) return;

    if (allPoints.length === 1) {
      this.map.flyTo({ center: allPoints[0], zoom: 14 });
      return;
    }

    const bounds = new LngLatBounds(allPoints[0], allPoints[0]);
    allPoints.forEach((p) => bounds.extend(p));

    this.map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 16
    });
  }
}

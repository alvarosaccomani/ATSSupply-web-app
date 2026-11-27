import { Injectable } from '@angular/core';

export interface GeoCoordinate {
  lat?: number | null;
  lng?: number | null;
}

export interface RouteOptimizationResult<T extends GeoCoordinate> {
  orderedStops: T[];
  distanceBeforeKm: number;
  distanceAfterKm: number;
  savedKm: number;
  savedPercentage: number;
  unroutedStopsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class RouteOptimizerService {
  /**
   * Calcula la distancia geodésica entre dos puntos geográficos usando la fórmula de Haversine.
   * Retorna la distancia en kilómetros.
   */
  public haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio medio de la Tierra en kilómetros
    const dLat = this._toRadians(lat2 - lat1);
    const dLon = this._toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRadians(lat1)) *
        Math.cos(this._toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calcula la distancia total acumulada de una secuencia de paradas partiendo desde un origen dado.
   */
  public calculateTotalDistance<T extends GeoCoordinate>(
    origin: { lat: number; lng: number } | null,
    stops: T[]
  ): number {
    const valid = stops.filter((s) => s.lat != null && s.lng != null);
    if (valid.length === 0) return 0;

    let total = 0;
    let prevLat = origin ? origin.lat : valid[0].lat!;
    let prevLng = origin ? origin.lng : valid[0].lng!;

    const startIndex = origin ? 0 : 1;
    for (let i = startIndex; i < valid.length; i++) {
      const curLat = valid[i].lat!;
      const curLng = valid[i].lng!;
      total += this.haversineDistance(prevLat, prevLng, curLat, curLng);
      prevLat = curLat;
      prevLng = curLng;
    }

    return Number(total.toFixed(2));
  }

  /**
   * Resuelve el ordenamiento óptimo de paradas (TSP) aplicando la heurística
   * del Vecino Más Cercano (Nearest Neighbor) y refinamiento local 2-Opt.
   *
   * @param origin Punto de partida (ej. base de la empresa o chofer)
   * @param stops Lista de paradas a ordenar
   */
  public optimizeRoute<T extends GeoCoordinate>(
    origin: { lat: number; lng: number } | null,
    stops: T[]
  ): RouteOptimizationResult<T> {
    const validStops = stops.filter((s) => s.lat != null && s.lng != null);
    const invalidStops = stops.filter((s) => s.lat == null || s.lng == null);

    const distanceBeforeKm = this.calculateTotalDistance(origin, stops);

    if (validStops.length <= 1) {
      return {
        orderedStops: [...validStops, ...invalidStops],
        distanceBeforeKm,
        distanceAfterKm: distanceBeforeKm,
        savedKm: 0,
        savedPercentage: 0,
        unroutedStopsCount: invalidStops.length
      };
    }

    // 1. Fase Constructiva: Heurística del Vecino Más Cercano (Nearest Neighbor)
    const unvisited = [...validStops];
    const ordered: T[] = [];

    let currentLat = origin ? origin.lat : unvisited[0].lat!;
    let currentLng = origin ? origin.lng : unvisited[0].lng!;

    if (!origin) {
      ordered.push(unvisited.shift()!);
    }

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = this.haversineDistance(
          currentLat,
          currentLng,
          unvisited[i].lat!,
          unvisited[i].lng!
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }

      const nextStop = unvisited.splice(nearestIndex, 1)[0];
      ordered.push(nextStop);
      currentLat = nextStop.lat!;
      currentLng = nextStop.lng!;
    }

    // 2. Fase de Refinamiento: Algoritmo 2-Opt para desenredar cruces de ruta
    const refined = this._apply2Opt(origin, ordered);

    const distanceAfterKm = this.calculateTotalDistance(origin, refined);
    const savedKm = Number(Math.max(0, distanceBeforeKm - distanceAfterKm).toFixed(2));
    const savedPercentage =
      distanceBeforeKm > 0 ? Number(((savedKm / distanceBeforeKm) * 100).toFixed(1)) : 0;

    return {
      orderedStops: [...refined, ...invalidStops],
      distanceBeforeKm,
      distanceAfterKm,
      savedKm,
      savedPercentage,
      unroutedStopsCount: invalidStops.length
    };
  }

  /**
   * Refinamiento local 2-Opt: evalúa intercambios de pares de aristas
   * para eliminar cruces y reducir la distancia geodésica.
   */
  private _apply2Opt<T extends GeoCoordinate>(
    origin: { lat: number; lng: number } | null,
    stops: T[]
  ): T[] {
    let route = [...stops];
    let improved = true;
    let iterations = 0;
    const maxIterations = 50; // Límite de iteraciones para UI fluida

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 0; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const delta = this._calculate2OptDelta(origin, route, i, k);
          if (delta < -0.01) {
            route = this._2OptSwap(route, i, k);
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return route;
  }

  private _2OptSwap<T>(route: T[], i: number, k: number): T[] {
    const part1 = route.slice(0, i);
    const part2 = route.slice(i, k + 1).reverse();
    const part3 = route.slice(k + 1);
    return [...part1, ...part2, ...part3];
  }

  private _calculate2OptDelta<T extends GeoCoordinate>(
    origin: { lat: number; lng: number } | null,
    route: T[],
    i: number,
    k: number
  ): number {
    const prevPoint =
      i === 0
        ? origin
        : { lat: route[i - 1].lat!, lng: route[i - 1].lng! };
    const currentPoint = { lat: route[i].lat!, lng: route[i].lng! };
    const nextPoint = { lat: route[k].lat!, lng: route[k].lng! };
    const afterPoint =
      k === route.length - 1
        ? null
        : { lat: route[k + 1].lat!, lng: route[k + 1].lng! };

    let currentDistance = 0;
    let newDistance = 0;

    if (prevPoint) {
      currentDistance += this.haversineDistance(
        prevPoint.lat,
        prevPoint.lng,
        currentPoint.lat,
        currentPoint.lng
      );
      newDistance += this.haversineDistance(
        prevPoint.lat,
        prevPoint.lng,
        nextPoint.lat,
        nextPoint.lng
      );
    }

    if (afterPoint) {
      currentDistance += this.haversineDistance(
        nextPoint.lat,
        nextPoint.lng,
        afterPoint.lat,
        afterPoint.lng
      );
      newDistance += this.haversineDistance(
        currentPoint.lat,
        currentPoint.lng,
        afterPoint.lat,
        afterPoint.lng
      );
    }

    return newDistance - currentDistance;
  }

  private _toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

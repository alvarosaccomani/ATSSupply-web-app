import { CompanySettingInterface } from '@interfaces/company-setting';

export type DefaultCompanySettingTemplate = Omit<CompanySettingInterface, 'cmp_uuid' | 'cmps_uuid' | 'cmps_createdat' | 'cmps_updatedat'>;

export const DEFAULT_COMPANY_SETTINGS: DefaultCompanySettingTemplate[] = [
  {
    cmps_key: 'STOCK_DEDUCTION_MODE',
    cmps_parameter: 'Modo de Descuento de Stock',
    cmps_description: 'Define si el stock sale de cámara al cargar la camioneta (ON_TRUCK_LOAD) o al momento de entregar cada pedido (ON_DELIVERY).',
    cmps_value: 'ON_DELIVERY',
    cmps_datatype: 'string',
    dtp_uuid: '680fd25d-d138-408a-8929-693893c0e722',
    cmps_options: 'ON_DELIVERY,ON_TRUCK_LOAD',
    cmps_group: 'OPERACIONES'
  },
  {
    cmps_key: 'ALLOW_NEGATIVE_STOCK',
    cmps_parameter: 'Permitir Venta con Stock Negativo',
    cmps_description: 'Habilita o bloquea la emisión de pedidos cuando no hay existencia física registrada en cámara.',
    cmps_value: 'false',
    cmps_datatype: 'boolean',
    dtp_uuid: 'c41b4853-bb62-4889-8866-d77c99689f1f',
    cmps_options: 'true,false',
    cmps_group: 'OPERACIONES'
  },
  {
    cmps_key: 'DEFAULT_PRICE_TIER',
    cmps_parameter: 'Lista de Precios Predeterminada',
    cmps_description: 'Categoría de precio sugerida al dar de alta nuevos clientes (ej: Categoría A / Mostrador).',
    cmps_value: 'A',
    cmps_datatype: 'string',
    dtp_uuid: '680fd25d-d138-408a-8929-693893c0e722',
    cmps_options: 'A,B,C',
    cmps_group: 'FACTURACION'
  },
  {
    cmps_key: 'INVOICE_POINT_OF_SALE',
    cmps_parameter: 'Punto de Venta Predeterminado',
    cmps_description: 'Número de punto de venta fiscal/operativo asignado a la empresa para emisión de comprobantes.',
    cmps_value: '1',
    cmps_datatype: 'integer',
    dtp_uuid: 'a7e15110-814e-4a3c-a97e-a2a24248757b',
    cmps_options: null,
    cmps_group: 'FACTURACION'
  },
  {
    cmps_key: 'TICKET_FOOTER_NOTE',
    cmps_parameter: 'Leyenda al Pie del Ticket / Remito',
    cmps_description: 'Texto legal o de cortesía que se imprime al final de los comprobantes y remitos de entrega.',
    cmps_value: 'Gracias por su compra. Conserve su comprobante.',
    cmps_datatype: 'string',
    dtp_uuid: '680fd25d-d138-408a-8929-693893c0e722',
    cmps_options: null,
    cmps_group: 'IMPRESION'
  },
  {
    cmps_key: 'AUTO_PRINT_TICKET',
    cmps_parameter: 'Impresión Automática de Pedidos',
    cmps_description: 'Dispara automáticamente el diálogo de impresión al confirmar un pedido en el POS.',
    cmps_value: 'false',
    cmps_datatype: 'boolean',
    dtp_uuid: 'c41b4853-bb62-4889-8866-d77c99689f1f',
    cmps_options: 'true,false',
    cmps_group: 'IMPRESION'
  },
  {
    cmps_key: 'NOTIFY_LOW_STOCK',
    cmps_parameter: 'Notificar Alerta de Stock Bajo',
    cmps_description: 'Muestra alertas en el dashboard cuando un producto terminado alcanza su umbral mínimo de stock.',
    cmps_value: 'true',
    cmps_datatype: 'boolean',
    dtp_uuid: 'c41b4853-bb62-4889-8866-d77c99689f1f',
    cmps_options: 'true,false',
    cmps_group: 'NOTIFICACIONES'
  }
];

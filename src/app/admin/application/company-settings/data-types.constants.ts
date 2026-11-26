export interface DataTypeDefinition {
  dtp_uuid: string;
  code: string;
  name: string;
  description: string;
}

export const DATA_TYPES: DataTypeDefinition[] = [
  {
    dtp_uuid: '680fd25d-d138-408a-8929-693893c0e722',
    code: 'string',
    name: 'Cadena de Caracteres',
    description: 'Texto libre o caracteres alfanuméricos'
  },
  {
    dtp_uuid: 'c41b4853-bb62-4889-8866-d77c99689f1f',
    code: 'boolean',
    name: 'Lógico (Boolean)',
    description: 'Valor binario Verdadero o Falso'
  },
  {
    dtp_uuid: 'a7e15110-814e-4a3c-a97e-a2a24248757b',
    code: 'integer',
    name: 'Entero',
    description: 'Número entero sin decimales'
  },
  {
    dtp_uuid: '23e5b636-03a9-4601-99ef-393b0ce838b6',
    code: 'float',
    name: 'Decimal (Float)',
    description: 'Número con precisión decimal'
  },
  {
    dtp_uuid: '8e56cb45-fce5-43e2-b30f-2685df6f98fa',
    code: 'date',
    name: 'Fecha',
    description: 'Fecha calendario (AAAA-MM-DD)'
  },
  {
    dtp_uuid: '1602577b-be45-427a-8a38-c34413fe56ff',
    code: 'datetime',
    name: 'Fecha y Hora',
    description: 'Marca temporal completa con hora'
  },
  {
    dtp_uuid: '2d17ccdf-4890-4c02-8f50-d6ce20f072bf',
    code: 'array',
    name: 'Lista / Arreglo',
    description: 'Lista de elementos separados por coma o array'
  },
  {
    dtp_uuid: '2d17ccdf-4890-4c02-8f50-d6ce20f072bg',
    code: 'json',
    name: 'JSON',
    description: 'Objeto estructurado en formato JSON'
  }
];

export function getDataTypeByUuid(uuid?: string | null): DataTypeDefinition | undefined {
  if (!uuid) return undefined;
  return DATA_TYPES.find((d) => d.dtp_uuid.toLowerCase() === uuid.toLowerCase().trim());
}

export function getDataTypeByCode(code?: string | null): DataTypeDefinition | undefined {
  if (!code) return undefined;
  const normalized = code.toLowerCase().trim();
  // Tolerancias comunes (ej: number -> integer)
  if (normalized === 'number') {
    return DATA_TYPES.find((d) => d.code === 'integer');
  }
  return DATA_TYPES.find((d) => d.code.toLowerCase() === normalized);
}

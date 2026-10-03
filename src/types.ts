export type OrderStatus = 'PENDENTE' | 'EM PRODUÇÃO' | 'PRONTA' | 'ENTREGUE' | 'ATRASADA';

export interface ServiceItem {
  name: string; // e.g. 'AFIAÇÃO', 'TROCA DE CABO', 'BAINHA'
  details?: string; // e.g. 'CHIFRE DE CERVO' ou 'DE COURO'
  notes?: string; // observação específica
  price?: number; // valor cobrado por este serviço específico
}

export type UserRole = 'LOJA' | 'CUTELEIRO' | 'GUASQUEIRO';

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  services: ServiceItem[];
  totalAmount: number; // valor cobrado
  paidAmount: number; // valor de entrada
  isFullyPaid: boolean; // se já foi pago tudo
  deliveryDate: string; // YYYY-MM-DD
  photoUrl: string;
  photos?: string[]; // Multiple photos of the knife
  status: OrderStatus;
  bainhaStatus?: 'PENDENTE' | 'EM PRODUÇÃO' | 'PRONTA';
  bainhaCompletedAt?: string;
  bainhaFinalizada?: boolean;
  bainhaFinalizadaAt?: string;
  createdAt: string;
  completedAt?: string;
  deliveredAt?: string;
  createdBy: string;
  updatedAt: string;
}

export interface IntegrationLog {
  id: string;
  timestamp: string;
  source: 'LOJA' | 'CUTELEIRO' | 'GUASQUEIRO' | 'SERVIDOR' | 'SISTEMA';
  action: string;
  details: string;
  orderId?: string;
}

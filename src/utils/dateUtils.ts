/**
 * Date and urgency utility functions for Cutelaria orders
 */

export interface UrgencyInfo {
  diffDays: number;
  label: string;
  isUrgent: boolean; // <= 3 days or delayed
  isOverdue: boolean;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export function calculateUrgency(deliveryDateStr: string): UrgencyInfo {
  if (!deliveryDateStr) {
    return {
      diffDays: 999,
      label: 'DATA NÃO DEFINIDA',
      isUrgent: false,
      isOverdue: false,
      colorClass: 'text-stone-700',
      bgClass: 'bg-stone-100',
      borderClass: 'border-stone-300',
    };
  }

  // Parse YYYY-MM-DD
  const parts = deliveryDateStr.split('-');
  if (parts.length !== 3) {
    return {
      diffDays: 999,
      label: 'DATA INVÁLIDA',
      isUrgent: false,
      isOverdue: false,
      colorClass: 'text-stone-700',
      bgClass: 'bg-stone-100',
      borderClass: 'border-stone-300',
    };
  }

  const deliveryYear = parseInt(parts[0], 10);
  const deliveryMonth = parseInt(parts[1], 10) - 1;
  const deliveryDay = parseInt(parts[2], 10);

  const deliveryDate = new Date(deliveryYear, deliveryMonth, deliveryDay);
  deliveryDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = deliveryDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysLate = Math.abs(diffDays);
    return {
      diffDays,
      label: daysLate === 1 ? '🚨 ATRASADO HÁ 1 DIA' : `🚨 ATRASADO HÁ ${daysLate} DIAS`,
      isUrgent: true,
      isOverdue: true,
      colorClass: 'text-red-700',
      bgClass: 'bg-red-100',
      borderClass: 'border-red-500',
    };
  }

  if (diffDays === 0) {
    return {
      diffDays,
      label: '🚨 ENTREGA HOJE',
      isUrgent: true,
      isOverdue: false,
      colorClass: 'text-red-700',
      bgClass: 'bg-red-100',
      borderClass: 'border-red-500',
    };
  }

  if (diffDays === 1) {
    return {
      diffDays,
      label: '⚠️ ATENÇÃO: ENTREGA AMANHÃ',
      isUrgent: true,
      isOverdue: false,
      colorClass: 'text-red-700',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-400',
    };
  }

  if (diffDays === 2) {
    return {
      diffDays,
      label: '⚠️ ATENÇÃO: ENTREGA EM 2 DIAS',
      isUrgent: true,
      isOverdue: false,
      colorClass: 'text-red-700',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-400',
    };
  }

  if (diffDays === 3) {
    return {
      diffDays,
      label: '⚠️ ATENÇÃO: ENTREGA EM 3 DIAS',
      isUrgent: true,
      isOverdue: false,
      colorClass: 'text-red-700',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-400',
    };
  }

  return {
    diffDays,
    label: `FALTAM ${diffDays} DIAS`,
    isUrgent: false,
    isOverdue: false,
    colorClass: 'text-stone-700',
    bgClass: 'bg-stone-100',
    borderClass: 'border-stone-300',
  };
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeBR(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export function formatCurrency(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

/**
 * Play a polite gentle audio chime using Web Audio API
 */
export function playNotificationChime(type: 'new_order' | 'ready' | 'delivered') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (type === 'new_order') {
      // Pleasant double chime: 520Hz then 660Hz
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(520, ctx.currentTime);
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.55);
    } else if (type === 'ready') {
      // Victory / ready sound: ascending triad
      [587.33, 739.99, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    }
  } catch (e) {
    console.warn('Audio chime could not play:', e);
  }
}

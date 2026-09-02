import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createOrder } from '../../services/orderService';
import { PaymentMethod, BusinessSettings } from '../../types';
import { formatCurrency } from '../../utils/currency';
import confetti from 'canvas-confetti';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Truck,
  Store,
  CreditCard,
  Phone,
  User,
  MapPin,
  Mail,
  FileText,
  Send,
  Loader2,
  Receipt,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessSettings: BusinessSettings;
  onOrderCompleted?: (orderId: string, orderNumber: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  businessSettings,
  onOrderCompleted,
}) => {
  const { items, subtotal, discount, tax, total, clearCart } = useCart();
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [customerIdDoc, setCustomerIdDoc] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('Douala / Central');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pago_movil');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrderInfo, setCreatedOrderInfo] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

  // Pre-fill email if logged in
  useEffect(() => {
    if (user?.email && !customerEmail) {
      setCustomerEmail(user.email);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage('Por favor ingresa el nombre y apellido del cliente.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Por favor ingresa un número de teléfono / WhatsApp para contactarte.');
      return;
    }
    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      setErrorMessage('Por favor especifica la dirección de entrega a domicilio.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('El carrito de compras está vacío.');
      return;
    }

    setIsSubmitting(true);

    try {
      const fullDeliveryInfo =
        deliveryType === 'pickup'
          ? 'Retiro en Tienda (Local Central BIKIE)'
          : `${deliveryAddress.trim()}${deliveryCity ? `, ${deliveryCity.trim()}` : ''}${
              deliveryReference ? ` (Ref: ${deliveryReference.trim()})` : ''
            }`;

      const fullNotes = [
        customerIdDoc.trim() ? `NIF/C.I.: ${customerIdDoc.trim()}` : null,
        notes.trim() ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const orderPayload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        delivery_address: fullDeliveryInfo,
        payment_method: paymentMethod,
        notes: fullNotes || null,
        subtotal,
        discount,
        tax,
        total,
        items: items.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          original_unit_price: i.calculation.originalPrice,
          unit_price: i.calculation.finalPrice,
          discount_amount: i.calculation.discountAmount,
          total_price: i.calculation.finalPrice * i.quantity,
        })),
      };

      const result = await createOrder(orderPayload);

      setCreatedOrderInfo({
        orderId: result.order_id,
        orderNumber: result.order_number,
      });

      // Clear cart
      clearCart();

      // Launch celebration confetti
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch (_) {}

      if (onOrderCompleted) {
        onOrderCompleted(result.order_id, result.order_number);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppLink = () => {
    if (!createdOrderInfo) return '#';
    const cleanPhone = (businessSettings.whatsapp || businessSettings.phone || '').replace(/[^0-9]/g, '');

    const deliveryText =
      deliveryType === 'pickup'
        ? 'Retiro en Tienda Central BIKIE'
        : `${deliveryAddress || ''} (${deliveryCity})`;

    const msg =
      `¡Hola *BIKIE Papelería*! 👋 He registrado mi pedido *#${createdOrderInfo.orderNumber}*.%0A%0A` +
      `👤 *Cliente:* ${encodeURIComponent(customerName)}%0A` +
      (customerIdDoc ? `📄 *Documento/NIF:* ${encodeURIComponent(customerIdDoc)}%0A` : '') +
      `📞 *Teléfono:* ${encodeURIComponent(customerPhone)}%0A` +
      `💳 *Método de Pago:* ${(paymentMethod || 'EFECTIVO').toUpperCase()}%0A` +
      `📍 *Modalidad de Entrega:* ${encodeURIComponent(deliveryText)}%0A` +
      `💰 *Total Facturado:* ${encodeURIComponent(formatCurrency(total))}%0A%0A` +
      `Quedo atento a las instrucciones y confirmación. ¡Muchas gracias!`;

    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0d0d0d] rounded-sm max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/10 text-white relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-xs transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Screen */}
        {createdOrderInfo ? (
          <div className="text-center py-6 font-mono">
            <div className="w-16 h-16 rounded-xs bg-[#ff3e00] text-black flex items-center justify-center mx-auto mb-4 accent-glow animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
              ¡PEDIDO CONFIRMADO CON ÉXITO!
            </h2>

            <div className="my-4 inline-block px-5 py-2.5 rounded-xs bg-[#141414] border border-white/10">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest block font-mono">
                NÚMERO DE PEDIDO REGISTRADO
              </span>
              <span className="text-2xl font-mono font-black text-[#ff3e00]">
                {createdOrderInfo.orderNumber}
              </span>
            </div>

            <p className="text-xs text-white/60 max-w-md mx-auto mb-6 uppercase tracking-wider font-mono">
              Tu solicitud ha sido guardada en la base de datos de BIKIE y el stock ha sido reservado.
            </p>

            {/* Payment Details Box based on method */}
            <div className="p-4 rounded-xs bg-[#141414] border border-white/10 text-left mb-6 text-xs text-white/80 space-y-2 font-mono">
              <p className="font-black text-white uppercase tracking-wider flex items-center gap-1.5 text-xs text-[#ff3e00]">
                <Receipt className="w-4 h-4" />
                INSTRUCCIONES DE PAGO {paymentMethod ? `(${(paymentMethod || '').toUpperCase()})` : ''}:
              </p>
              {paymentMethod === 'pago_movil' && (
                <div className="space-y-1">
                  <p className="text-white font-bold">{businessSettings.pago_movil_info || 'Orange Money / MTN MoMo'}</p>
                  <p className="text-[11px] text-white/60">
                    Realiza la transferencia e indícanos el capture o referencia de confirmación.
                  </p>
                </div>
              )}
              {paymentMethod === 'binance' && (
                <div className="space-y-1">
                  <p className="text-white font-bold">{businessSettings.binance_info || 'Binance Pay ID / USDT'}</p>
                  <p className="text-[11px] text-white/60">Envía el comprobante con la referencia de pago (TXID).</p>
                </div>
              )}
              {paymentMethod === 'transferencia' && (
                <div className="space-y-1">
                  <p className="text-white font-bold">{businessSettings.bank_transfer_info || 'Cuenta Bancaria'}</p>
                  <p className="text-[11px] text-white/60">Transferencia en moneda local FCFA a nuestras cuentas comerciales.</p>
                </div>
              )}
              {paymentMethod === 'efectivo' && (
                <p className="text-[11px] text-white/80">
                  Pago en efectivo exacto ({formatCurrency(total)}) al momento de la entrega o retiro en tienda.
                </p>
              )}
              {paymentMethod === 'punto_venta' && (
                <p className="text-[11px] text-white/80">
                  Pago presencial con tarjeta de débito/crédito en nuestro punto de venta en caja.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={generateWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider rounded-xs text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Send className="w-4 h-4" />
                <span>CONFIRMAR POR WHATSAPP</span>
              </a>
              <button
                onClick={onClose}
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black uppercase tracking-wider rounded-xs text-xs transition-all cursor-pointer"
              >
                VOLVER AL CATÁLOGO
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <div>
            <div className="mb-6 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-black text-white font-display uppercase tracking-tight">
                FORMULARIO DE CLIENTE & FACTURACIÓN
              </h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">
                INGRESA TUS DATOS PARA REGISTRAR LA COMPRA Y GENERAR TU FACTURA
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#ef4444] text-xs font-bold flex items-center gap-2 mb-4 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOrder} className="space-y-5">
              {/* Section 1: Customer Personal Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#ef4444] font-mono">
                  <User className="w-4 h-4" />
                  <span>1. DATOS PERSONALES & CONTACTO</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1 font-mono">
                      Nombre y Apellido *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej. Jean-Paul Mbarga / Carlos Silva"
                        className="w-full pl-3 pr-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1 font-mono">
                      Teléfono / WhatsApp *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej. +237 600 000 000"
                        className="w-full pl-3 pr-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1 font-mono">
                      Doc. Identidad / NIF / C.I. (Opcional)
                    </label>
                    <input
                      type="text"
                      value={customerIdDoc}
                      onChange={(e) => setCustomerIdDoc(e.target.value)}
                      placeholder="Ej. NIF-123456 / CNI-987654"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1 font-mono">
                      Correo Electrónico (Opcional)
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Delivery Option */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#ef4444] font-mono">
                  <Truck className="w-4 h-4" />
                  <span>2. MODALIDAD DE ENTREGA</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer font-mono ${
                      deliveryType === 'pickup'
                        ? 'border-[#dc2626] bg-[#dc2626]/10 text-white shadow-md'
                        : 'border-white/10 bg-[#141414] text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Store className={`w-4 h-4 ${deliveryType === 'pickup' ? 'text-[#ef4444]' : 'text-white/40'}`} />
                      <span className="font-bold text-xs uppercase">Retiro en Tienda</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-tight">
                      Local Central BIKIE - Gratis
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer font-mono ${
                      deliveryType === 'delivery'
                        ? 'border-[#dc2626] bg-[#dc2626]/10 text-white shadow-md'
                        : 'border-white/10 bg-[#141414] text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className={`w-4 h-4 ${deliveryType === 'delivery' ? 'text-[#ef4444]' : 'text-white/40'}`} />
                      <span className="font-bold text-xs uppercase">Envío a Domicilio</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-tight">
                      Entrega directa en tu puerta
                    </p>
                  </button>
                </div>

                {deliveryType === 'delivery' && (
                  <div className="p-3 bg-[#141414] border border-white/10 rounded-lg space-y-3 font-mono animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                          Dirección / Calle / Número *
                        </label>
                        <input
                          type="text"
                          required={deliveryType === 'delivery'}
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Ej. Boulevard de la Liberté, Casa 24"
                          className="w-full px-3 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                          Ciudad / Sector
                        </label>
                        <input
                          type="text"
                          value={deliveryCity}
                          onChange={(e) => setDeliveryCity(e.target.value)}
                          placeholder="Ej. Douala / Akwa / Bonanjo"
                          className="w-full px-3 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                        Punto de Referencia (Opcional)
                      </label>
                      <input
                        type="text"
                        value={deliveryReference}
                        onChange={(e) => setDeliveryReference(e.target.value)}
                        placeholder="Ej. Frente a la farmacia, portón negro..."
                        className="w-full px-3 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Payment Method */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#ef4444] font-mono">
                  <CreditCard className="w-4 h-4" />
                  <span>3. MÉTODO DE PAGO</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'pago_movil', label: 'Orange / MTN MoMo' },
                    { id: 'efectivo', label: 'Efectivo FCFA' },
                    { id: 'binance', label: 'Binance Pay' },
                    { id: 'punto_venta', label: 'Punto de Venta' },
                    { id: 'transferencia', label: 'Transferencia' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`p-2.5 rounded-lg border text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer text-center font-mono ${
                        paymentMethod === m.id
                          ? 'border-[#dc2626] bg-[#dc2626] text-white shadow-md accent-glow'
                          : 'border-white/10 bg-[#141414] text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 4: Notes */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider font-mono">
                  NOTAS ADICIONALES / OBSERVACIONES (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Empaque especial para regalo, horario preferido de entrega..."
                  className="w-full px-3.5 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                />
              </div>

              {/* Summary recap */}
              <div className="p-4 rounded-lg bg-[#141414] border border-white/10 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-white/60">
                  <span>Productos en carrito ({items.length}):</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#ef4444] font-bold">
                    <span>Descuentos / Promociones aplicadas:</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Impuestos:</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-white/10">
                  <span className="uppercase tracking-wider">TOTAL A PAGAR:</span>
                  <span className="text-lg text-[#ef4444] font-black">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full py-4 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black uppercase tracking-[0.2em] rounded-xl text-xs flex items-center justify-center gap-2 accent-glow active:scale-98 transition-all cursor-pointer disabled:opacity-50 font-mono shadow-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>REGISTRANDO EN BASE DE DATOS...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CONFIRMAR Y CREAR PEDIDO ({formatCurrency(total)})</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};


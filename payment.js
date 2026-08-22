/** Razorpay-ready payment adapter. Add a live key and backend order/signature verification before production use. */
const DesiMallPayment = (() => {
  const config = { razorpayKey: '', businessName: 'DesiMall', currency: 'INR' };

  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve(true);
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function process({ amount, orderId, user, method }) {
    if (method === 'COD') return { success: true, status: 'Pending', transactionId: '' };
    if (!config.razorpayKey) {
      const accepted = confirm(`Demo payment mode\n\nPay ₹${Number(amount).toLocaleString('en-IN')} using ${method}?\n\nNo real money will be charged. Add a Razorpay key and server-side signature verification before going live.`);
      return accepted
        ? { success: true, status: 'Paid (Demo)', transactionId: `DEMO_${Date.now()}`, demo: true }
        : { success: false, message: 'Payment cancelled.' };
    }
    const loaded = await loadRazorpay();
    if (!loaded) return { success: false, message: 'Payment service could not be loaded.' };
    return new Promise(resolve => {
      const options = {
        key: config.razorpayKey,
        amount: Math.round(Number(amount) * 100),
        currency: config.currency,
        name: config.businessName,
        description: `Order ${orderId}`,
        prefill: { name: user?.Name || '', email: user?.Email || '', contact: user?.Mobile || '' },
        theme: { color: '#ff6b00' },
        handler: response => resolve({ success: true, status: 'Paid - Verification Pending', transactionId: response.razorpay_payment_id }),
        modal: { ondismiss: () => resolve({ success: false, message: 'Payment cancelled.' }) }
      };
      new Razorpay(options).open();
    });
  }

  return { process, config };
})();

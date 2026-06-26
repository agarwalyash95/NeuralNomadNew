import razorpay

RAZORPAY_KEY_ID = "rzp_test_T3c6kbC89tjuvC"
RAZORPAY_KEY_SECRET = "8qan9pXKz7Sjyn7ycZ2JSbpB"

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def create_order(amount_inr, receipt_id, notes=None):
    """
    Creates a Razorpay order. Amount is in INR, will be converted to paise internally.
    """
    data = {
        "amount": int(amount_inr * 100), # Amount is in currency subunits (paise)
        "currency": "INR",
        "receipt": receipt_id,
        "notes": notes or {}
    }
    return client.order.create(data=data)

def verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """
    Verifies the payment signature returned by Razorpay checkout.
    """
    try:
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        client.utility.verify_payment_signature(params_dict)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False

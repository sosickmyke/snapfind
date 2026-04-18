import axios from 'axios';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_BASE = 'https://api.flutterwave.com/v3';

export const initializePaystack = async (
  email: string,
  amount: number, // in kobo
  reference: string,
  metadata?: any
) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount,
        reference,
        metadata,
        callback_url: `${process.env.CLIENT_URL}/payment/verify`
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Payment initialization failed');
  }
};

export const verifyPaystack = async (reference: string) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`
        }
      }
    );
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Payment verification failed');
  }
};

export const initializeFlutterwave = async (
  email: string,
  amount: number,
  reference: string,
  phone?: string
) => {
  try {
    const response = await axios.post(
      `${FLUTTERWAVE_BASE}/payments`,
      {
        tx_ref: reference,
        amount,
        currency: 'NGN',
        redirect_url: `${process.env.CLIENT_URL}/payment/verify`,
        customer: {
          email,
          phone_number: phone || ''
        },
        customizations: {
          title: 'SnapFind Event Registration',
          description: 'Event photo access payment'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Payment initialization failed');
  }
};

export const verifyFlutterwave = async (transactionId: string) => {
  try {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET}`
        }
      }
    );
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Payment verification failed');
  }
};

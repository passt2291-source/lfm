# Stripe Payment Deployment Guide for Vercel

## Issues Fixed

### 1. Webhook Signature Verification
- Enhanced error handling for missing signatures and webhook secrets
- Improved logging for debugging webhook issues
- Added proper error responses for signature verification failures

### 2. Environment Variables
- Removed hardcoded env config from `next.config.js` to let Vercel handle them directly
- Added fallback for Stripe publishable key environment variable names
- Added mongoose external package configuration for serverless functions

### 3. Vercel Configuration
- Created `vercel.json` with proper function timeout settings for webhook processing
- Added API route rewrites for proper routing

## Required Environment Variables on Vercel

Set these environment variables in your Vercel dashboard:

### Required Variables:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
STRIPE_PRIVATE_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe webhook endpoint)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_... (or pk_test_... for testing)
AUTH_SECRET=your_auth_secret
```

### Optional Variables:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (alternative name for public key)
```

## Stripe Webhook Configuration

### 1. Create Webhook Endpoint in Stripe Dashboard
- Go to Stripe Dashboard > Developers > Webhooks
- Click "Add endpoint"
- URL: `https://your-vercel-domain.vercel.app/api/webhooks/stripe`
- Events to send: `payment_intent.succeeded`

### 2. Get Webhook Secret
- After creating the webhook, click on it
- Copy the "Signing secret" (starts with `whsec_`)
- Add this as `STRIPE_WEBHOOK_SECRET` in Vercel environment variables

## Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Fix Stripe payment issues for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Set all required environment variables in Vercel dashboard
   - Deploy the project

3. **Configure Stripe Webhook**
   - Update webhook URL in Stripe dashboard to your Vercel domain
   - Ensure webhook secret is correctly set in environment variables

4. **Test Payment Flow**
   - Create a test order
   - Complete payment using Stripe test cards
   - Verify webhook receives payment confirmation
   - Check order status updates correctly

## Common Issues and Solutions

### Issue: "Webhook signature verification failed"
**Solution:** Ensure `STRIPE_WEBHOOK_SECRET` is correctly set and matches the webhook endpoint secret in Stripe dashboard.

### Issue: "Missing stripe-signature header"
**Solution:** Verify webhook URL is correct and Stripe is sending requests to the right endpoint.

### Issue: Environment variables not found
**Solution:** Double-check all environment variables are set in Vercel dashboard and redeploy.

### Issue: Function timeout
**Solution:** The `vercel.json` configuration sets webhook timeout to 30 seconds. For longer processing, increase this value.

## Testing

### Test Cards (Stripe Test Mode):
- Success: `4242424242424242`
- Decline: `4000000000000002`
- Requires authentication: `4000002500003155`

### Webhook Testing:
- Use Stripe CLI to forward webhooks to localhost during development
- Check Vercel function logs for webhook processing details
- Monitor Stripe dashboard for webhook delivery status

## Security Notes

- Never commit API keys to version control
- Use test keys during development
- Rotate webhook secrets if compromised
- Monitor webhook endpoint logs for suspicious activity

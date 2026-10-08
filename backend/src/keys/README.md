# E-Invoice Public Keys

This folder contains the IRP (Invoice Registration Portal / NIC) public keys used for encrypting API authentication credentials (AppKey and Password) when communicating with TaxPro GSP / NIC e-Invoice System.

## Files

- `einv_sandbox.pem`: The official NIC Sandbox public key used for Sandbox / Testing environment. This key is pre-configured and ready to use out of the box.
- `einv_production.pem`: (Optional) Production public key downloaded from the NIC e-Invoice portal for live e-invoicing.

## Configuration

If you do not have any PEM key files:
- In **Sandbox mode**, the system automatically uses the bundled `einv_sandbox.pem` (or its built-in memory fallback). No manual configuration or file download is needed!
- In **Production mode**, once live credentials are ready, download the public key from the NIC e-Invoice portal (`https://einvoice1.gst.gov.in`), and either:
  1. Save it here as `einv_production.pem`, OR
  2. Set `TAXPRO_PRODUCTION_PUBLIC_KEY_PATH` in `.env` to the path of your key file, OR
  3. Paste the PEM string into `TAXPRO_PRODUCTION_PUBLIC_KEY` in `.env` (use `\n` for line breaks).

  The sandbox variables (`TAXPRO_PUBLIC_KEY_PATH` / `TAXPRO_PUBLIC_KEY`) are never used in Production mode.

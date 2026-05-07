# Specification: Appliance Local Networking & Security

**Audience:** Implementation AI Agent
**Context:** OrdoSite is designed to run as a local appliance. However, modern browsers aggressively restrict advanced features (Microphone access for Voice Chat, Service Workers, Secure WebSockets) if the site is served over standard `http://localhost` or a raw IP address. This specification defines the local networking layer required to bypass these restrictions securely.

## 1. Local Network Discovery (mDNS)
Users should not need to memorize the raw IP address of the Docker container on their LAN.
*   **The Requirement:** The appliance must broadcast itself over the local network.
*   **The Implementation:** The `ordo-daemon` will use an mDNS (Multicast DNS / Bonjour) crate (like `mdns-sd`) to broadcast a local hostname, such as `ordosite.local`. 

## 2. SSL / TLS Termination
To enable secure features, the appliance must serve traffic over HTTPS, even on a local network.
*   **The Challenge:** You cannot easily get a Let's Encrypt certificate for a `.local` domain or a raw local IP address.
*   **The Solution (Self-Signed CA):** The `ordo-daemon` will dynamically generate a self-signed Root Certificate Authority (CA) and a leaf SSL certificate for `ordosite.local` using a crate like `rcgen` upon first boot.
*   **Trusting the CA:** The UI will provide instructions for the user to download and install this Root CA into their OS/Browser trust store. Once trusted, the browser will treat `https://ordosite.local` as fully secure.

## 3. The Reverse Proxy Role
Because the Rust daemon now handles SSL termination, it must act as the front door for all traffic.
*   The `ordo-daemon` binds to port `443` (HTTPS).
*   **WebSocket Traffic:** If the path is `/subscribe` or `/realtime`, Rust upgrades the connection and handles the WebSocket natively (as defined in the Realtime Broker spec).
*   **Standard Traffic:** For all other requests, Rust strips the SSL layer and acts as a reverse proxy, forwarding the raw HTTP traffic to the Next.js server running internally on port `3000`.

## Agent Research Directives
1. Research the `rcgen` crate for dynamically generating Root CAs and leaf certificates in Rust.
2. Prototype a basic `axum` server that binds to TLS, handles WebSockets directly, and reverse-proxies standard `GET/POST` traffic to a dummy internal port.
3. Verify that `mdns-sd` successfully broadcasts a `.local` domain that is resolvable by an iOS/Android device on the same WiFi network.

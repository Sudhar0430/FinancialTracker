// Point this at your deployed Render backend URL after deployment.
// During local development it falls back to localhost:5000.
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : 'https://YOUR-RENDER-SERVICE.onrender.com/api'; // <-- replace after you deploy the backend

// src/services/deliveryService.js
import axios from 'axios';

const getHeaders = (token, contentType = 'application/json') => ({
    headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType
    }
});

export const deliveryService = {
    // Obtener clústeres optimizados (Admin)
    async getAdminZones(token, numZones) {
        const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/admin/optimize-zones?n_clusters=${numZones}`,
            getHeaders(token)
        );
        return res.data;
    },

    // Obtener pedidos del Cliente
    async getUserOrders(token) {
        const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/orders/user/my-orders`,
            getHeaders(token)
        );
        return res.data;
    },

    // Obtener pedidos activos del Driver
    async getDriverOrders(token) {
        const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/orders/driver/my-orders`,
            getHeaders(token)
        );
        return res.data;
    },

    // Obtener lista de conductores (Admin)
    async getDrivers(token) {
        const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/admin/drivers`,
            getHeaders(token)
        );
        return res.data;
    },

    // Crear pedido nuevo
    async createOrder(token, orderData) {
        const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/orders`,
            orderData,
            getHeaders(token)
        );
        return res.data;
    },

    // Asignar pedido a conductor (Usa query params)
    async assignOrderToDriver(token, orderId, driverId) {
        const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/admin/assign-order?order_id=${orderId}&driver_id=${parseInt(driverId)}`,
            {},
            getHeaders(token)
        );
        return res.data;
    },

    // Eliminar pedido
    async deleteOrder(token, orderId) {
        const res = await axios.delete(
            `${import.meta.env.VITE_API_URL}/orders/${orderId}`,
            getHeaders(token)
        );
        return res.data;
    },

    // Actualizar coordenadas en el arrastre (Usa query params)
    async updateOrderLocation(token, orderId, lng, lat) {
        const res = await axios.put(
            `${import.meta.env.VITE_API_URL}/orders/${orderId}/location?lng=${lng}&lat=${lat}`,
            {},
            getHeaders(token)
        );
        return res.data;
    },

    // Marcar pedido como entregado (Soporta opcionalmente FormData)
    async deliverOrder(token, orderId, file = null) {
        const formData = new FormData();
        if (file) formData.append('file', file);

        const res = await axios.patch(
            `${import.meta.env.VITE_API_URL}/orders/${orderId}/deliver`,
            formData,
            getHeaders(token, 'multipart/form-data')
        );
        return res.data;
    },

    // Reportar incidente (Formulario multipart para compatibilidad con FastAPI)
    async reportIncident(token, orderId, incidentType, description, file = null) {
        const formData = new FormData();
        formData.append('incident_type', incidentType);
        formData.append('description', description);
        if (file) formData.append('file', file);

        const res = await axios.patch(
            `${import.meta.env.VITE_API_URL}/orders/${orderId}/incident`,
            formData,
            getHeaders(token, 'multipart/form-data')
        );
        return res.data;
    }
};
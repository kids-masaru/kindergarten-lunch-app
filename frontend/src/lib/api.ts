import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const login = async (login_id: string, password: string) => {
    const res = await api.post('/login', { login_id, password });
    return res.data;
};

export const getMasters = async (kindergarten_id: string) => {
    const res = await api.get(`/masters/${kindergarten_id}`);
    return res.data;
};

export const getCalendar = async (kindergarten_id: string, year: number, month: number) => {
    const res = await api.get('/calendar', { params: { kindergarten_id, year, month } });
    return res.data;
};

export const saveOrder = async (orderData: any) => {
    const res = await api.post('/orders', orderData);
    return res.data;
};

export const updateClassMaster = async (data: {
    kindergarten_id: string;
    class_name: string;
    default_student_count: number;
    default_allergy_count: number;
    default_teacher_count: number;
}) => {
    const res = await api.post('/masters/class', data);
    return res.data;
};

export const updateKindergartenSettings = async (data: {
    kindergarten_id: string;
    service_mon?: boolean;
    service_tue?: boolean;
    service_wed?: boolean;
    service_thu?: boolean;
    service_fri?: boolean;
    service_sat?: boolean;
    service_sun?: boolean;
}) => {
    const res = await api.put('/masters/kindergarten', data);
    return res.data;
};

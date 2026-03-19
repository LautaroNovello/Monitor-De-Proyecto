import api from './axiosConfig';

export interface Contact {
    id: number;
    name: string;
    phoneNumber: string;
    isActive: boolean;
    subscribedProjects: Array<{ id: number; name: string }>;
}

export const getContacts = (): Promise<Contact[]> =>
    api.get<Contact[]>('/contacts').then(r => r.data);

export const createContact = (dto: { name: string; phoneNumber: string }): Promise<Contact> =>
    api.post<Contact>('/contacts', dto).then(r => r.data);

export const deleteContact = (id: number): Promise<void> =>
    api.delete(`/contacts/${id}`).then(() => undefined);

export const subscribeContact = (contactId: number, projectId: number): Promise<Contact> =>
    api.post<Contact>(`/contacts/${contactId}/subscribe/${projectId}`).then(r => r.data);

export const unsubscribeContact = (contactId: number, projectId: number): Promise<Contact> =>
    api.delete<Contact>(`/contacts/${contactId}/subscribe/${projectId}`).then(r => r.data);

export const testWhatsApp = (contactId: number): Promise<{ status: string }> =>
    api.post<{ status: string }>(`/contacts/${contactId}/test`).then(r => r.data);

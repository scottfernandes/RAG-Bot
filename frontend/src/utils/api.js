import axios from "axios";

const API_BASE = "http://localhost:8000";

export const askQuestion = (query) => axios.post(`${API_BASE}/ask`, { query });

export const uploadFiles = (files) => {
  const formData = new FormData();
  for (let file of files) formData.append("files", file);
  return axios.post(`${API_BASE}/upload-files`, formData);
};

export const voiceInput = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return axios.post(`${API_BASE}/voice-input`, formData);
};

export const voiceOutput = (text) => {
  return axios.post(`${API_BASE}/voice-output`, { query: text }, { responseType: "blob" });
};

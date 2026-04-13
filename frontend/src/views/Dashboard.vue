<script setup>
import { ref, onMounted, watch } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();

const invoices = ref([]);
const showModal = ref(false);
const selectedFile = ref(null);
const previewUrl = ref(null);
const showCamera = ref(false);

const videoRef = ref(null);
const canvasRef = ref(null);
const stream = ref(null);

// ======================
// FETCH
// ======================
const fetchInvoices = async () => {
  const res = await axios.get(`${import.meta.env.VITE_API_BASE}/invoices`);
  invoices.value = res.data.data;
};

// ======================
// PREVIEW FIX (CRASH FIX)
// ======================
watch(selectedFile, (file) => {
  if (file instanceof File) {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = URL.createObjectURL(file);
  } else {
    previewUrl.value = null;
  }
});

// ======================
// NAVIGATION
// ======================
const goToInvoice = (id) => {
  router.push(`/invoice/${id}`);
};

// ======================
// FILE
// ======================
const handleFileChange = (e) => {
  selectedFile.value = e.target.files[0];
};

// ======================
// UPLOAD
// ======================
const uploadInvoice = async () => {
  if (!selectedFile.value) return alert("Select file");

  const formData = new FormData();
  formData.append("file", selectedFile.value);

  await axios.post(
    `${import.meta.env.VITE_API_BASE}/upload-invoice`,
    formData
  );

  showModal.value = false;
  selectedFile.value = null;
  fetchInvoices();
};

// ======================
// ACTIONS
// ======================
const approveInvoice = async (id) => {
  await axios.put(
    `${import.meta.env.VITE_API_BASE}/invoices/${id}/approve`
  );
  fetchInvoices();
};

const rejectInvoice = async (id) => {
  await axios.put(
    `${import.meta.env.VITE_API_BASE}/invoices/${id}/reject`
  );
  fetchInvoices();
};

// ======================
// CAMERA
// ======================
const startCamera = async () => {
  stream.value = await navigator.mediaDevices.getUserMedia({ video: true });
  videoRef.value.srcObject = stream.value;
  showCamera.value = true;
};

const stopCamera = () => {
  stream.value?.getTracks().forEach((t) => t.stop());
  showCamera.value = false;
};

const captureImage = () => {
  const canvas = canvasRef.value;
  const video = videoRef.value;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    selectedFile.value = new File([blob], "camera.png");
  });

  stopCamera();
};

onMounted(fetchInvoices);
</script>

<template>
  <div class="min-h-screen bg-gray-100 p-4">

    <div class="flex justify-between mb-4">
      <h1 class="text-xl font-bold">Invoice Dashboard</h1>
      <button @click="showModal = true" class="bg-blue-600 text-white px-4 py-2 rounded">
        + Add Invoice
      </button>
    </div>

    <!-- TABLE -->
    <table class="w-full bg-white rounded shadow">
      <thead class="bg-gray-200">
        <tr>
          <th class="p-3">Vendor</th>
          <th>Invoice</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Dept</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="inv in invoices" :key="inv._id" @click="goToInvoice(inv._id)" class="cursor-pointer">
          <td class="p-3">{{ inv.vendor }}</td>
          <td>{{ inv.invoice_no }}</td>
          <td>{{ inv.total }}</td>

          <td :class="inv.status === 'approved' ? 'text-green-600' : 'text-yellow-600'">
            {{ inv.status }}
          </td>

          <td>{{ inv.department }}</td>

          <td>
            <button @click.stop="approveInvoice(inv._id)">✔</button>
            <button @click.stop="rejectInvoice(inv._id)">❌</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- MODAL -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex justify-center items-center">
      <div class="bg-white p-6 rounded w-96">

        <input type="file" accept="image/*,.pdf" @change="handleFileChange" />

        <button @click="startCamera" class="bg-green-600 text-white mt-2 px-2 py-1">
          Camera
        </button>

        <img v-if="previewUrl" :src="previewUrl" class="mt-3" />

        <div v-if="showCamera">
          <video ref="videoRef" autoplay class="w-full"></video>
          <canvas ref="canvasRef" class="hidden"></canvas>
          <button @click="captureImage">Capture</button>
          <button @click="stopCamera">Cancel</button>
        </div>

        <button @click="uploadInvoice" class="bg-blue-600 text-white mt-3 px-3 py-1">
          Upload
        </button>

      </div>
    </div>

  </div>
</template>
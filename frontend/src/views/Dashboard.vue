<script setup>
import { ref, onMounted, nextTick } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";

const toast = useToast();
const router = useRouter();

const invoices = ref([]);
const showModal = ref(false);
const selectedFile = ref(null);
const showCamera = ref(false);
const uploading = ref(false);

const videoRef = ref(null);
const canvasRef = ref(null);
const stream = ref(null);

// ======================
// FETCH DATA
// ======================
const fetchInvoices = async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_BASE}/invoices`);
    invoices.value = res.data.data;
  } catch (err) {
    toast.error("Failed to load invoices");
  }
};

// ======================
// NAVIGATION
// ======================
const goToInvoice = (id) => {
  router.push(`/invoice/${id}`);
};

// ======================
// FILE HANDLING
// ======================
const handleFileChange = (e) => {
  const file = e.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    return toast.error("Only image files allowed");
  }

  selectedFile.value = file;
  toast.success("Image selected");
};

// ======================
// UPLOAD
// ======================
const uploadInvoice = async () => {
  if (!selectedFile.value) {
    return toast.error("Select or capture image first");
  }

  try {
    uploading.value = true;

    const formData = new FormData();
    formData.append("file", selectedFile.value);

    await axios.post(`${import.meta.env.VITE_API_BASE}/upload-invoice`, formData);

    toast.success("Invoice uploaded 🚀");

    showModal.value = false;
    selectedFile.value = null;

    fetchInvoices();
  } catch (err) {
    toast.error(err.response?.data?.error || "Upload failed");
  } finally {
    uploading.value = false;
  }
};

// ======================
// APPROVE / REJECT
// ======================
const approveInvoice = async (id) => {
  try {
    await axios.put(`${import.meta.env.VITE_API_BASE}/invoices/${id}/approve`);
    toast.success("Approved");
    fetchInvoices();
  } catch {
    toast.error("Approval failed");
  }
};

const rejectInvoice = async (id) => {
  try {
    await axios.put(`${import.meta.env.VITE_API_BASE}/invoices/${id}/reject`);
    toast.success("Rejected");
    fetchInvoices();
  } catch {
    toast.error("Rejection failed");
  }
};

// ======================
// CAMERA
// ======================
const startCamera = async () => {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    });

    showCamera.value = true;

    await nextTick();
    videoRef.value.srcObject = stream.value;

  } catch {
    toast.error("Camera access denied");
  }
};

const stopCamera = () => {
  stream.value?.getTracks().forEach(t => t.stop());
  stream.value = null;
  showCamera.value = false;
};

const captureImage = () => {
  const canvas = canvasRef.value;
  const video = videoRef.value;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext("2d").drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    selectedFile.value = new File([blob], "camera.png");
    toast.success("Image captured 📸");
  });

  stopCamera();
};

onMounted(fetchInvoices);
</script>

<template>
  <div class="min-h-screen bg-gray-100 p-4">

    <!-- HEADER -->
    <div class="flex justify-between mb-4">
      <h1 class="text-xl font-bold">Invoice Dashboard</h1>

      <button
        class="bg-blue-600 text-white px-4 py-2 rounded"
        @click="showModal = true"
      >
        + Add Invoice
      </button>
    </div>

    <!-- TABLE -->
    <div class="bg-white rounded shadow overflow-x-auto hidden md:block">
      <table class="w-full">
        <tbody>
          <tr
            v-for="inv in invoices"
            :key="inv._id"
            class="border-t hover:bg-gray-50 cursor-pointer"
            @click="goToInvoice(inv._id)"
          >
            <td class="p-3">{{ inv.vendor }}</td>
            <td class="p-3">{{ inv.invoice_no }}</td>
            <td class="p-3">{{ inv.total }}</td>

            <td class="p-3"
              :class="inv.status === 'approved'
                ? 'text-green-600'
                : inv.status === 'rejected'
                ? 'text-red-600'
                : 'text-yellow-600'">
              {{ inv.status }}
            </td>

            <td class="p-3">{{ inv.department }}</td>

            <td class="p-3 space-x-2">
              <button @click.stop="approveInvoice(inv._id)">✔</button>
              <button @click.stop="rejectInvoice(inv._id)">❌</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MOBILE -->
    <div class="md:hidden space-y-3">
      <div
        v-for="inv in invoices"
        :key="inv._id"
        class="bg-white p-4 rounded shadow"
      >
        <p class="font-bold">{{ inv.vendor }}</p>
        <p>{{ inv.invoice_no }}</p>
        <p>{{ inv.total }}</p>

        <p>{{ inv.status }}</p>

        <div class="mt-2 space-x-3">
          <button @click="approveInvoice(inv._id)">✔</button>
          <button @click="rejectInvoice(inv._id)">❌</button>
        </div>
      </div>
    </div>

    <!-- MODAL -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center">
      <div class="bg-white w-full md:max-w-md p-5 rounded-t-xl md:rounded">

        <h2 class="font-bold mb-3">Upload Invoice</h2>

        <!-- FILE -->
        <div v-if="!showCamera">
          <input type="file" @change="handleFileChange" />

          <button
            class="bg-green-600 text-white w-full py-2 rounded mt-3"
            @click="startCamera"
          >
            📸 Use Camera
          </button>
        </div>

        <!-- CAMERA -->
        <div v-if="showCamera">
          <video ref="videoRef" autoplay playsinline class="w-full h-64 bg-black rounded"></video>

          <canvas ref="canvasRef" class="hidden"></canvas>

          <div class="flex gap-2 mt-3">
            <button @click="captureImage" class="flex-1 bg-blue-600 text-white py-2 rounded">Capture</button>
            <button @click="stopCamera" class="flex-1 bg-gray-500 text-white py-2 rounded">Cancel</button>
          </div>
        </div>

        <!-- PREVIEW -->
        <div v-if="selectedFile" class="mt-3">
          <img
            :src="URL.createObjectURL(selectedFile)"
            class="w-full max-h-60 object-contain rounded border"
          />

          <button
            class="text-red-600 text-sm mt-1"
            @click="selectedFile = null"
          >
            Remove
          </button>
        </div>

        <!-- ACTIONS -->
        <div class="flex justify-end mt-4 gap-2">
          <button @click="showModal = false" class="bg-gray-300 px-3 py-2 rounded">
            Cancel
          </button>

          <button
            @click="uploadInvoice"
            :disabled="uploading"
            class="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"
          >
            {{ uploading ? "Uploading..." : "Upload" }}
          </button>
        </div>

      </div>
    </div>

  </div>
</template>
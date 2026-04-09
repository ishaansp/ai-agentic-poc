<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();

const invoices = ref([]);
const showModal = ref(false);
const selectedFile = ref(null);
const showCamera = ref(false);

const videoRef = ref(null);
const canvasRef = ref(null);
const stream = ref(null);

// ======================
// FETCH DATA
// ======================
const fetchInvoices = async () => {
  try {
    const res = await axios.get("http://192.168.1.5:3000/invoices");
    invoices.value = res.data.data;
  } catch (err) {
    console.error(err);
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
  selectedFile.value = e.target.files[0];
};

// ======================
// UPLOAD
// ======================
const uploadInvoice = async () => {
  if (!selectedFile.value) return alert("Select file");

  const formData = new FormData();
  formData.append("file", selectedFile.value);

  try {
    await axios.post("http://192.168.1.5:3000/upload-invoice", formData);

    showModal.value = false;
    selectedFile.value = null;

    fetchInvoices();
  } catch (err) {
    console.error(err);
  }
};

// ======================
// APPROVE / REJECT
// ======================
const approveInvoice = async (id) => {
  await axios.put(`http://192.168.1.5:3000/invoices/${id}/approve`);
  fetchInvoices();
};

const rejectInvoice = async (id) => {
  await axios.put(`http://192.168.1.5:3000/invoices/${id}/reject`);
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

    <!-- HEADER -->
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-xl md:text-2xl font-bold">Invoice Dashboard</h1>

      <button
        class="bg-blue-600 text-white px-4 py-2 rounded"
        @click="showModal = true"
      >
        + Add Invoice
      </button>
    </div>

    <!-- DESKTOP TABLE -->
    <div class="hidden md:block bg-white rounded shadow overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-200">
          <tr>
            <th class="p-3">Vendor</th>
            <th class="p-3">Invoice</th>
            <th class="p-3">Amount</th>
            <th class="p-3">Status</th>
            <th class="p-3">Dept</th>
            <th class="p-3">Actions</th>
          </tr>
        </thead>

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

            <td
              class="p-3"
              :class="inv.status === 'approved'
                ? 'text-green-600'
                : inv.status === 'rejected'
                ? 'text-red-600'
                : 'text-yellow-600'"
            >
              {{ inv.status }}
            </td>

            <td class="p-3">{{ inv.department }}</td>

            <td class="p-3 space-x-2">
              <template v-if="inv.status === 'pending'">
                <button @click.stop="approveInvoice(inv._id)" class="text-green-600">✔</button>
                <button @click.stop="rejectInvoice(inv._id)" class="text-red-600">❌</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MOBILE CARDS -->
    <div class="md:hidden space-y-3">
      <div
        v-for="inv in invoices"
        :key="inv._id"
        class="bg-white p-4 rounded shadow"
      >
        <p class="font-bold">{{ inv.vendor }}</p>
        <p>{{ inv.invoice_no }}</p>
        <p>{{ inv.total }}</p>

        <p
          :class="inv.status === 'approved'
            ? 'text-green-600'
            : inv.status === 'rejected'
            ? 'text-red-600'
            : 'text-yellow-600'"
        >
          {{ inv.status }}
        </p>

        <div class="mt-2 space-x-3">
          <button @click="approveInvoice(inv._id)" class="text-green-600">✔</button>
          <button @click="rejectInvoice(inv._id)" class="text-red-600">❌</button>
        </div>
      </div>
    </div>

    <!-- MODAL -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex justify-center items-center">
      <div class="bg-white p-6 rounded w-full max-w-md">

        <h2 class="text-xl font-bold mb-4">Upload Invoice</h2>

        <!-- FILE -->
        <input type="file" @change="handleFileChange" />

        <!-- CAMERA -->
        <button
          class="bg-green-600 text-white px-3 py-2 rounded mt-2"
          @click="startCamera"
        >
          📸 Camera
        </button>

        <!-- PREVIEW -->
        <img
          v-if="selectedFile"
          :src="URL.createObjectURL(selectedFile)"
          class="mt-3 rounded"
        />

        <!-- CAMERA VIEW -->
        <div v-if="showCamera" class="mt-3">
          <video ref="videoRef" autoplay class="w-full"></video>
          <canvas ref="canvasRef" class="hidden"></canvas>

          <button @click="captureImage" class="bg-blue-600 text-white px-3 py-2 mt-2">Capture</button>
          <button @click="stopCamera" class="bg-gray-500 text-white px-3 py-2 mt-2">Cancel</button>
        </div>

        <!-- ACTIONS -->
        <div class="flex justify-end mt-4 space-x-2">
          <button @click="showModal = false" class="bg-gray-300 px-3 py-2 rounded">Cancel</button>
          <button @click="uploadInvoice" class="bg-blue-600 text-white px-3 py-2 rounded">Upload</button>
        </div>

      </div>
    </div>

  </div>
</template>
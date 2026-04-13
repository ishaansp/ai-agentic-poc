<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";
import { useRoute } from "vue-router";

const route = useRoute();
const invoice = ref(null);

// ✅ FIX: define once and reuse everywhere
const API_BASE = import.meta.env.VITE_API_BASE;

const fetchInvoice = async () => {
  try {
    const res = await axios.get(
      `${API_BASE}/invoices/${route.params.id}`
    );
    invoice.value = res.data.data;
  } catch (err) {
    console.error("Fetch error:", err);
  }
};

onMounted(fetchInvoice);
</script>

<template>
  <div v-if="invoice" class="p-4">

    <h1 class="text-xl font-bold mb-4">Invoice Detail</h1>

    <p><b>Vendor:</b> {{ invoice.vendor }}</p>
    <p><b>Invoice:</b> {{ invoice.invoice_no }}</p>
    <p><b>Total:</b> {{ invoice.total }}</p>
    <p><b>Status:</b> {{ invoice.status }}</p>

    <!-- IMAGE -->
    <img
      v-if="invoice.file_type?.includes('image')"
      :src="`${API_BASE}/uploads/${invoice.image_url}`"
      class="mt-4 w-full rounded border"
    />

    <!-- PDF -->
    <iframe
      v-else-if="invoice.file_type?.includes('pdf')"
      :src="`${API_BASE}/uploads/${invoice.image_url}`"
      class="w-full h-[500px] mt-4 border"
    ></iframe>

    <!-- FALLBACK -->
    <p v-else class="mt-4 text-gray-500">
      No preview available for this file type
    </p>

  </div>
</template>
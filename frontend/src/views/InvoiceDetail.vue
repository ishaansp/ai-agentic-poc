<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";
import { useRoute } from "vue-router";

const route = useRoute();
const invoice = ref(null);

const fetchInvoice = async () => {
  try {
    const res = await axios.get(
      `http://192.168.1.5:3000/invoices/${route.params.id}`
    );
    invoice.value = res.data.data;
  } catch (err) {
    console.error(err);
  }
};

const approveInvoice = async () => {
  await axios.put(
    `http://192.168.1.5:3000/invoices/${route.params.id}/approve`
  );
  fetchInvoice();
};

const rejectInvoice = async () => {
  await axios.put(
    `http://192.168.1.5:3000/invoices/${route.params.id}/reject`
  );
  fetchInvoice();
};

onMounted(fetchInvoice);
</script>

<template>
  <div class="min-h-screen bg-gray-100 p-4" v-if="invoice">
    <div class="bg-white p-6 rounded shadow max-w-3xl mx-auto">

      <h1 class="text-2xl font-bold mb-4">Invoice Details</h1>

      <!-- Details -->
      <div class="space-y-2">
        <p><b>Vendor:</b> {{ invoice.vendor }}</p>
        <p><b>GSTIN:</b> {{ invoice.gstin }}</p>
        <p><b>Invoice No:</b> {{ invoice.invoice_no }}</p>
        <p><b>Date:</b> {{ invoice.date }}</p>
        <p><b>Amount:</b> {{ invoice.amount }}</p>
        <p><b>Total:</b> {{ invoice.total }}</p>
        <p><b>Status:</b> {{ invoice.status }}</p>
        <p><b>Department:</b> {{ invoice.department }}</p>
      </div>

      <!-- Image -->
      <div class="mt-4">
        <img
          v-if="invoice.image_url"
          :src="invoice.image_url"
          class="w-full rounded border"
        />
      </div>

      <!-- Actions -->
      <div class="mt-6 space-x-4">
        <button
          v-if="invoice.status === 'pending'"
          @click="approveInvoice"
          class="bg-green-600 text-white px-4 py-2 rounded"
        >
          Approve
        </button>

        <button
          v-if="invoice.status === 'pending'"
          @click="rejectInvoice"
          class="bg-red-600 text-white px-4 py-2 rounded"
        >
          Reject
        </button>
      </div>

    </div>
  </div>
</template>
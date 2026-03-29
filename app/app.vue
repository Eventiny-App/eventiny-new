<template>
  <div>
    <div v-if="!isOnline" class="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 text-sm font-medium">
      You are offline — check your connection
    </div>
    <div :class="{ 'pt-9': !isOnline }">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
const { isOnline } = useOnlineStatus()
</script>

// vite.config.js
import { defineConfig } from "file:///C:/Users/zoney/Desktop/space-race/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/zoney/Desktop/space-race/node_modules/@vitejs/plugin-react/dist/index.mjs";
import viteCompression from "file:///C:/Users/zoney/Desktop/space-race/node_modules/vite-plugin-compression/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: "brotliCompress" }),
    viteCompression({ algorithm: "gzip" })
  ],
  resolve: {
    dedupe: ["three", "@react-three/fiber"]
  },
  esbuild: {
    drop: ["console", "debugger"]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          r3f: ["@react-three/fiber", "@react-three/drei"],
          rapier: ["@react-three/rapier", "@dimforge/rapier3d-compat"],
          ecctrl: ["ecctrl"]
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "@react-three/rapier",
      "three-stdlib"
    ]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx6b25leVxcXFxEZXNrdG9wXFxcXHNwYWNlLXJhY2VcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHpvbmV5XFxcXERlc2t0b3BcXFxcc3BhY2UtcmFjZVxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvem9uZXkvRGVza3RvcC9zcGFjZS1yYWNlL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB2aXRlQ29tcHJlc3Npb24gZnJvbSAndml0ZS1wbHVnaW4tY29tcHJlc3Npb24nXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB2aXRlQ29tcHJlc3Npb24oeyBhbGdvcml0aG06ICdicm90bGlDb21wcmVzcycgfSksXG4gICAgdml0ZUNvbXByZXNzaW9uKHsgYWxnb3JpdGhtOiAnZ3ppcCcgfSlcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGRlZHVwZTogWyd0aHJlZScsICdAcmVhY3QtdGhyZWUvZmliZXInXSxcbiAgfSxcbiAgZXNidWlsZDoge1xuICAgIGRyb3A6IFsnY29uc29sZScsICdkZWJ1Z2dlciddLFxuICB9LFxuICBidWlsZDoge1xuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICB0aHJlZTogWyd0aHJlZSddLFxuICAgICAgICAgIHIzZjogWydAcmVhY3QtdGhyZWUvZmliZXInLCAnQHJlYWN0LXRocmVlL2RyZWknXSxcbiAgICAgICAgICByYXBpZXI6IFsnQHJlYWN0LXRocmVlL3JhcGllcicsICdAZGltZm9yZ2UvcmFwaWVyM2QtY29tcGF0J10sXG4gICAgICAgICAgZWNjdHJsOiBbJ2VjY3RybCddXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICd0aHJlZScsXG4gICAgICAnQHJlYWN0LXRocmVlL2ZpYmVyJyxcbiAgICAgICdAcmVhY3QtdGhyZWUvZHJlaScsXG4gICAgICAnQHJlYWN0LXRocmVlL3JhcGllcicsXG4gICAgICAndGhyZWUtc3RkbGliJyxcbiAgICBdLFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1IsU0FBUyxvQkFBb0I7QUFDNVQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8scUJBQXFCO0FBRzVCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLGdCQUFnQixFQUFFLFdBQVcsaUJBQWlCLENBQUM7QUFBQSxJQUMvQyxnQkFBZ0IsRUFBRSxXQUFXLE9BQU8sQ0FBQztBQUFBLEVBQ3ZDO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxRQUFRLENBQUMsU0FBUyxvQkFBb0I7QUFBQSxFQUN4QztBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTSxDQUFDLFdBQVcsVUFBVTtBQUFBLEVBQzlCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixPQUFPLENBQUMsT0FBTztBQUFBLFVBQ2YsS0FBSyxDQUFDLHNCQUFzQixtQkFBbUI7QUFBQSxVQUMvQyxRQUFRLENBQUMsdUJBQXVCLDJCQUEyQjtBQUFBLFVBQzNELFFBQVEsQ0FBQyxRQUFRO0FBQUEsUUFDbkI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

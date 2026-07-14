import { getLunarHeight } from "../utils/lunarHeightfield";

const _tmpNormal = { x: 0, y: 0, z: 0 };

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  v.x /= len;
  v.y /= len;
  v.z /= len;
}

self.onmessage = function (e) {
  const { id, type, data } = e.data;
  
  if (type === "GENERATE_CHUNK") {
    const { CHUNK_SIZE, segments, worldX, worldZ, seed, heightOptions } = data;
    
    const segmentWidth = CHUNK_SIZE / segments;
    const segmentHeight = CHUNK_SIZE / segments;
    const halfWidth = CHUNK_SIZE / 2;
    const halfHeight = CHUNK_SIZE / 2;
    
    const gridX = segments;
    const gridY = segments;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    
    const vertices = new Float32Array(gridX1 * gridY1 * 3);
    const normals = new Float32Array(gridX1 * gridY1 * 3);
    const indices = new Uint16Array(gridX * gridY * 6);
    
    let offset = 0;
    
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - halfHeight;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - halfWidth;
        
        const px = worldX + x;
        const pz = worldZ - (-y); 
        
        const h = getLunarHeight(px, pz, seed, heightOptions);
        
        vertices[offset] = x;
        vertices[offset + 1] = -y;
        vertices[offset + 2] = h;
        
        const eps = 0.5;
        const hl = getLunarHeight(px - eps, pz, seed, heightOptions);
        const hr = getLunarHeight(px + eps, pz, seed, heightOptions);
        const hd = getLunarHeight(px, pz - eps, seed, heightOptions);
        const hu = getLunarHeight(px, pz + eps, seed, heightOptions);
        
        _tmpNormal.x = hl - hr;
        _tmpNormal.y = hd - hu;
        _tmpNormal.z = 2 * eps;
        normalize(_tmpNormal);
        
        normals[offset] = _tmpNormal.x;
        normals[offset + 1] = _tmpNormal.y;
        normals[offset + 2] = _tmpNormal.z;
        
        offset += 3;
      }
    }
    
    offset = 0;
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = (ix + 1) + gridX1 * (iy + 1);
        const d = (ix + 1) + gridX1 * iy;
        
        indices[offset] = a;
        indices[offset + 1] = b;
        indices[offset + 2] = d;
        indices[offset + 3] = b;
        indices[offset + 4] = c;
        indices[offset + 5] = d;
        offset += 6;
      }
    }
    
    self.postMessage(
      {
        id,
        positions: vertices,
        normals: normals,
        indices: indices,
      },
      [vertices.buffer, normals.buffer, indices.buffer]
    );
  }
  
  if (type === "GENERATE_PHYSICS") {
    const { CHUNK_SIZE, segments, worldX, worldZ, seed, heightOptions } = data;
    
    const segmentWidth = CHUNK_SIZE / segments;
    const segmentHeight = CHUNK_SIZE / segments;
    const halfWidth = CHUNK_SIZE / 2;
    const halfHeight = CHUNK_SIZE / 2;
    
    const gridX = segments;
    const gridY = segments;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    
    const vertices = new Float32Array(gridX1 * gridY1 * 3);
    const indices = new Uint16Array(gridX * gridY * 6);
    
    let offset = 0;
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - halfHeight;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - halfWidth;
        const px = worldX + x;
        const pz = worldZ - (-y);
        
        const h = getLunarHeight(px, pz, seed, heightOptions);
        
        vertices[offset] = x;
        vertices[offset + 1] = -y;
        vertices[offset + 2] = h;
        offset += 3;
      }
    }
    
    offset = 0;
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = (ix + 1) + gridX1 * (iy + 1);
        const d = (ix + 1) + gridX1 * iy;
        
        indices[offset] = a;
        indices[offset + 1] = b;
        indices[offset + 2] = d;
        indices[offset + 3] = b;
        indices[offset + 4] = c;
        indices[offset + 5] = d;
        offset += 6;
      }
    }
    
    self.postMessage(
      {
        id,
        positions: vertices,
        indices: indices,
      },
      [vertices.buffer, indices.buffer]
    );
  }
};

import { Vector3 } from "three";

// Client-side knockback prediction done the proper way: instead of a fixed
// position offset (which makes the victim lurch back, FREEZE, then snap to the
// real networked position a beat later), we predict a KNOCKBACK VELOCITY and
// integrate it — so the victim flies back on the shooter's screen at roughly
// the real rate while the network is late. Each frame we reconcile the
// predicted motion against how far the victim's REAL (network) position has
// actually travelled: the rendered offset is only the part the network hasn't
// confirmed yet, so as the real position catches up the offset shrinks to zero
// smoothly. No frozen hold, no snap, no catch-up lurch.
const _predictions = new Map();
const _tmp = new Vector3();
const DRAG_TAU = 2.0; // predicted velocity eases like real drag (kept gentle)
const RECONCILE = 0.3; // how fast the offset converges to the reconciled target

export function predictKnockback(playerId, dir, speed) {
  let p = _predictions.get(playerId);
  if (!p) {
    p = { dir: new Vector3(), pv: new Vector3(), offset: new Vector3(), baseline: null, setAt: 0 };
    _predictions.set(playerId, p);
  }
  p.dir.set(dir.x, dir.y, dir.z).normalize();
  p.pv.set(p.dir).multiplyScalar(speed); // predicted knockback velocity
  p.offset.set(0, 0, 0);
  p.baseline = null; // captured against the first interpolated network pos
  p.setAt = performance.now() / 1000;
}

// netPos: the victim's dead-reckoned network position this frame.
// delta: frame time. Returns an offset Vector3 to ADD to the rendered position.
export function consumeKnockback(playerId, netPos, delta) {
  const p = _predictions.get(playerId);
  if (!p) return null;
  const now = performance.now() / 1000;
  if (!p.baseline) p.baseline = new Vector3(netPos.x, netPos.y, netPos.z);

  // Integrate the predicted knockback velocity (with a little drag, mirroring
  // the real impulse) so the victim accelerates backward on this screen.
  p.pv.multiplyScalar(Math.exp(-delta / DRAG_TAU));
  p.offset.addScaledVector(p.pv, delta);

  // How far the victim's REAL (network) position has actually moved along the
  // knockback direction since the hit.
  const progressed =
    (netPos.x - p.baseline.x) * p.dir.x +
    (netPos.y - p.baseline.y) * p.dir.y +
    (netPos.z - p.baseline.z) * p.dir.z;

  // We only need to show the part of the predicted motion the network hasn't
  // confirmed yet. As the real position catches up, this target -> 0.
  const predMag = p.offset.length();
  const target = Math.max(0, predMag - Math.max(0, progressed));
  _tmp.copy(p.dir).multiplyScalar(target);
  p.offset.lerp(_tmp, RECONCILE);

  if (now - p.setAt > 2.0 || p.offset.lengthSq() < 1e-4) {
    _predictions.delete(playerId);
    return null;
  }
  return p.offset;
}

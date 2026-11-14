import type { ExtractedIfcTakeoff } from "./types";

export interface RawMeshMetric {
  name: string;
  materialName: string;
  sx: number;
  sy: number;
  sz: number;
}

const WORKER_SOURCE = `
self.onmessage = function(e) {
  var items = e.data.items || [];
  var formatLabel = e.data.formatLabel || "3D";
  var buckets = {};
  for (var i = 0; i < items.length; i++) {
    var m = items[i];
    var layerKey = (m.materialName || m.name || ("Camada " + formatLabel)).trim();
    var lower = layerKey.toLowerCase();
    var category = "AREAS";
    if (lower.indexOf("window") !== -1 || lower.indexOf("door") !== -1 || lower.indexOf("vidro") !== -1 || lower.indexOf("esquad") !== -1) {
      category = "ESQUADRIAS";
    } else if (lower.indexOf("pilar") !== -1 || lower.indexOf("viga") !== -1 || lower.indexOf("laje") !== -1 || lower.indexOf("slab") !== -1 || lower.indexOf("concret") !== -1 || lower.indexOf("column") !== -1) {
      category = "ESTRUTURA";
    } else if (lower.indexOf("revest") !== -1 || lower.indexOf("pis") !== -1 || lower.indexOf("mad") !== -1 || lower.indexOf("gess") !== -1) {
      category = "REVESTIMENTOS";
    } else if (lower.indexOf("elet") !== -1 || lower.indexOf("lumin") !== -1 || lower.indexOf("light") !== -1) {
      category = "ELETRICO";
    } else if (lower.indexOf("hidr") !== -1 || lower.indexOf("tub") !== -1 || lower.indexOf("pipe") !== -1) {
      category = "HIDRAULICO";
    }
    var area = (m.sx * m.sy + m.sy * m.sz + m.sx * m.sz) * 2;
    var prev = buckets[layerKey] || { count: 0, areaM2: 0, maxL: 0, maxP: 0, maxA: 0, category: category };
    buckets[layerKey] = {
      count: prev.count + 1,
      areaM2: prev.areaM2 + area,
      maxL: Math.max(prev.maxL, m.sx),
      maxP: Math.max(prev.maxP, m.sz),
      maxA: Math.max(prev.maxA, m.sy),
      category: category
    };
  }
  var keys = Object.keys(buckets).slice(0, 20);
  var result = keys.map(function(name) {
    var b = buckets[name];
    return {
      category: b.category,
      description: name + " (" + b.count + "x · " + b.maxL.toFixed(2) + "×" + b.maxP.toFixed(2) + "×" + b.maxA.toFixed(2) + "m)",
      quantity: Number(b.areaM2.toFixed(2)),
      unit: "m²"
    };
  });
  self.postMessage({ result: result });
};
`;

export function aggregateSceneTakeoffInWorker(
  items: RawMeshMetric[],
  formatLabel: string
): Promise<ExtractedIfcTakeoff[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Worker === "undefined" || typeof Blob === "undefined") {
      resolve([]);
      return;
    }

    try {
      const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      worker.onmessage = (ev) => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve((ev.data?.result as ExtractedIfcTakeoff[]) || []);
      };

      worker.onerror = () => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve([]);
      };

      worker.postMessage({ items, formatLabel });
    } catch {
      resolve([]);
    }
  });
}

/* 纯前端 CSV 合并去重演示，无网络请求。可同时在浏览器和 Node 下测试。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.CsvDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function parseCSV(text) {
    if (typeof text !== "string") throw new TypeError("CSV must be text");
    const input = text.replace(/^\uFEFF/, "");
    let records = [], row = [], field = "", quoted = false, justClosed = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { quoted = false; justClosed = true; }
        else field += ch;
      } else if (ch === ',') {
        row.push(field); field = ""; justClosed = false;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field); records.push(row); row = []; field = ""; justClosed = false;
        if (ch === '\r' && input[i + 1] === '\n') i++;
      } else if (ch === '"' && field === "" && !justClosed) {
        quoted = true;
      } else if (justClosed && ch === " ") {
        // accept padding between closing quote and comma, keep original value
      } else if (ch === '"') {
        throw new Error("CSV 引号位置错误");
      } else if (justClosed) {
        throw new Error("CSV 引号后存在非法字符");
      } else {
        field += ch;
      }
    }
    if (quoted) throw new Error("CSV 引号未闭合");
    if (row.length || field !== "" || justClosed) {
      row.push(field); records.push(row);
    }
    if (!records.length || records[0].length === 0) throw new Error("CSV 内容为空");
    const headers = records.shift();
    if (headers.some(v => !v.trim()) || new Set(headers).size !== headers.length) {
      throw new Error("表头为空或有重名字段");
    }
    for (const [index, values] of records.entries()) {
      if (values.length !== headers.length) {
        throw new Error("第 " + (index + 2) + " 行字段数与表头不一致");
      }
    }
    return { headers, records };
  }

  function mergeCSV(files, key) {
    if (!Array.isArray(files) || files.length < 1 || files.length > 3) {
      throw new Error("最多支持 3 份 CSV 文件");
    }
    const parsed = files.map(f => ({name:f.name || "示例",...parseCSV(f.text)}));
    const headers = Array.from(new Set(parsed.flatMap(v => v.headers)));
    const selected = key || headers[0];
    if (!selected || parsed.some(p => !p.headers.includes(selected))) {
      throw new Error("每份文件都需要包含去重字段：" + selected);
    }
    let total = 0, dropped = 0, data = [], seen = new Set();
    for (const file of parsed) {
      const pos = Object.fromEntries(file.headers.map((h,i) => [h,i]));
      for (const line of file.records) {
        total++;
        if (total > 10000) throw new Error("演示限制最多 10,000 行");
        const id = line[pos[selected]].trim();
        // 缺少标识符的行保留但不合并，避免误删
        if (id && seen.has(id)) { dropped++; continue; }
        if (id) seen.add(id);
        data.push(headers.map(h => pos[h] === undefined ? "" : line[pos[h]]));
      }
    }
    return { headers, rows:data, inputRows:total, outputRows:data.length, deduplicatedRows:dropped, key:selected };
  }

  function escapeSpreadsheetFormula(value) {
    const s=String(value ?? "");
    // 纯负数保留，避免把合法金额误判为公式；其他公式型文本加前导引号
    if (/^\s*[=+@]/.test(s) || (/^\s*-/.test(s) && !/^\s*-\d+(?:\.\d+)?\s*$/.test(s))) {
      return "'" + s;
    }
    return s;
  }

  function toCSV(headers, rows) {
    function enc(v) {
      const x=escapeSpreadsheetFormula(v);
      return /[",\r\n]/.test(x) ? '"' + x.replace(/"/g,'""') + '"' : x;
    }
    return "\uFEFF" + [headers,...rows].map(line=>line.map(enc).join(",")).join("\r\n") + "\r\n";
  }
  return { parseCSV, mergeCSV, toCSV, escapeSpreadsheetFormula };
});
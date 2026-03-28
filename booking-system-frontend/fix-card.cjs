const fs = require("fs");
const file = "src/admin/WalkInEnrollment.jsx";
let content = fs.readFileSync(file, "utf8");

const startStr = "const renderPromoSlotCard = (slot, isSelected, onClick, chip) => {";
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf("const renderPromoCalendar = ", startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `const renderPromoSlotCard = (slot, isSelected, onClick, chip) => {
    const isFull = slot.available_slots === 0;
    const bookedPct = ((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100;
    const sessionMeta = {
        "Morning": { icon: "??", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", pill: "bg-orange-100 text-orange-700" },
        "Afternoon": { icon: "??", color: "#ca8a04", bg: "#fefce8", border: "#fde68a", pill: "bg-yellow-100 text-yellow-700" },
        "Whole Day": { icon: "??", color: "#2157da", bg: "#eff6ff", border: "#bfdbfe", pill: "bg-blue-100 text-blue-700" },
    }[slot.session] || { icon: "??", color: "#2157da", bg: "#eff6ff", border: "#bfdbfe", pill: "bg-blue-100 text-blue-700" };

    const statusColor = isFull ? "#ef4444" : bookedPct > 70 ? "#f59e0b" : "#22c55e";
    const statusLabel = isFull ? "FULL" : bookedPct > 70 ? "FILLING UP" : "OPEN";
    const statusBg = isFull ? "#fef2f2" : bookedPct > 70 ? "#fffbeb" : "#f0fdf4";
    const statusText = isFull ? "#dc2626" : bookedPct > 70 ? "#b45309" : "#15803d";

    const cardBg = isSelected ? "linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)" : isFull ? "#f8fafc" : "white";
    const cardBorder = isSelected ? "transparent" : isFull ? "#e2e8f0" : "#e2e8f0";

    return (
        <button
            key={slot.id}
            type="button"
            onClick={onClick}
            disabled={isFull}
            style={{ background: cardBg, borderColor: cardBorder, borderWidth: "2px", borderStyle: "solid", borderRadius: "1rem", padding: 0, textAlign: "left", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", transition: "all 0.2s", opacity: isFull ? 0.6 : 1, cursor: isFull ? "not-allowed" : "pointer", minHeight: "200px", width: "100%" }}
        >
            <div style={{ height: "6px", width: "100%", flexShrink: 0, background: isSelected ? "rgba(255,255,255,0.3)" : sessionMeta.color }} />
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", flex: 1, width: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{sessionMeta.icon}</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.25rem 0.625rem", borderRadius: "9999px", ...(isSelected ? { background: "rgba(255,255,255,0.18)", color: "#fff" } : { background: sessionMeta.bg, color: sessionMeta.color, border: \`1px solid \${sessionMeta.border}\` }) }}>{slot.session}</span>
                    </div>
                    <span style={{ fontSize: "0.625rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.25rem 0.625rem", borderRadius: "9999px", ...(isFull ? { background: "#fef2f2", color: "#dc2626" } : isSelected ? { background: "rgba(255,255,255,0.18)", color: "#fff" } : { background: statusBg, color: statusText }) }}>{isSelected ? "? SELECTED" : statusLabel}</span>
                </div>
                
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", lineHeight: 1.25, color: isSelected ? "rgba(255,255,255,0.65)" : "#94a3b8" }}>{chip || (slot.type?.toLowerCase() === "tdc" ? "TDC" : "PDC")}</p>
                <p style={{ fontSize: "1rem", fontWeight: 900, marginBottom: "0.25rem", color: isSelected ? "#fff" : "#1e293b" }}>{slot.session} Session</p>
                
                {slot.date && (
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.75rem", color: isSelected ? "rgba(255,255,255,0.7)" : "#64748b" }}>
                        ?? {slot.end_date && slot.end_date !== slot.date ? \`\${new Date(slot.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – \${new Date(slot.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}\` : new Date(slot.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                    </p>
                )}
                
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.875rem", fontWeight: 700, marginBottom: "1rem", color: isSelected ? "rgba(255,255,255,0.9)" : "#334155" }}>
                    <svg style={{ width: "16px", height: "16px", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><polyline points="12 6 12 12 16 14" strokeWidth="2" /></svg>
                    {slot.time_range}
                </div>
                
                <div style={{ marginTop: "auto" }}>
                    <div style={{ height: "6px", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.5rem", background: isSelected ? "rgba(255,255,255,0.2)" : "#e2e8f0" }}>
                        <div style={{ height: "100%", borderRadius: "9999px", transition: "all 0.2s", width: \`\${bookedPct}%\`, background: isSelected ? "rgba(255,255,255,0.8)" : statusColor }} />
                    </div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.65)" : "#64748b" }}>{(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Students Enrolled</p>
                </div>
            </div>
            
            {isSelected && (
                <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
                    <div style={{ width: "24px", height: "24px", background: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                        <svg style={{ width: "16px", height: "16px", color: "#2157da" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                </div>
            )}
        </button>
    );
            };
            
            `;
    
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
    fs.writeFileSync(file, content);
    console.log("Replaced!");
} else {
    console.log("Not found.");
}


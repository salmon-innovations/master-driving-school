
const fs = require("fs");
const file = "./src/admin/WalkInEnrollment.jsx";
let content = fs.readFileSync(file, "utf8");

const replacement = `{daySlots.map(slot => {\n    const isFullyBooked = slot.available_slots === 0;\n    const isSelected = formData.scheduleSlotId === slot.id || formData.scheduleSlotId2 === slot.id || formData.promoPdcSlotId2 === slot.id;\n    const sessionLabel = (() => {\n        const sn = (slot.session || "").toLowerCase();\n        if (sn.includes("morning")) return "Morning Class";\n        if (sn.includes("afternoon")) return "Afternoon Class";\n        if (sn.includes("whole")) return "Whole Day";\n        return slot.session || "PDC";\n    })();\n    const countLabel = isFullyBooked ? "FULL" : \`\${slot.available_slots} Slots\`;\n    const timeStr = (slot.time_range || "").toLowerCase().replace(/ - /g, " / ").replace(/ am/g, "am").replace(/ pm/g, "pm");\n\n    return (\n        <div key={slot.id} onClick={(e) => { e.stopPropagation(); if (isFullyBooked) return; if (typeof onDateClick === "function" && typeof cy !== "undefined") { onDateClick(new Date(cy, cm, d)); if (typeof promoStep !== "undefined" && promoStep === 2 && !formData.scheduleSlotId2) { handlePromoPdcDay1Select(slot); } else if (typeof promoPdcSelectingDay2 !== "undefined" && promoPdcSelectingDay2) { handlePromoPdcDay2Select(slot); } } else { setSelectedScheduleDate(dateStr); handleScheduleSelect(slot); } }} style={{ width: "100%", textAlign: "left", borderRadius: "6px", border: "1px solid", padding: "5px 6px", display: "flex", flexDirection: "column", gap: "2px", cursor: isFullyBooked ? "not-allowed" : "pointer", transition: "all 0.2s", backgroundColor: isSelected ? "#2563eb" : isFullyBooked ? "#fef2f2" : "#ffffff", borderColor: isSelected ? "#2563eb" : isFullyBooked ? "#fee2e2" : "#dbeafe", boxShadow: isSelected ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)" : "none", marginBottom: "4px" }}>\n            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "4px", flexWrap: "nowrap" }}>\n                <span style={{ fontSize: "0.65rem", fontWeight: "900", lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isSelected ? "#ffffff" : isFullyBooked ? "#b91c1c" : "#2563eb", letterSpacing: "-0.01em" }}>{sessionLabel}</span>\n                <span style={{ fontSize: "0.6rem", fontWeight: "800", padding: "1px 4px", borderRadius: "4px", flexShrink: 0, backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : isFullyBooked ? "#fee2e2" : "#eff6ff", color: isSelected ? "#ffffff" : isFullyBooked ? "#b91c1c" : "#2563eb", lineHeight: "1.2", marginLeft: "auto" }}>{countLabel}</span>\n            </div>\n            <span style={{ fontSize: "0.6rem", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isSelected ? "#dbeafe" : isFullyBooked ? "#f87171" : "#6b7280" }}>{timeStr}</span>\n        </div>\n    );\n})}`;

const regex = /\{\(\(\) => \{\s*const morningSlots = daySlots\.filter[\s\S]*?renderSubBox\([^)]+\)\s*\}\s*<\/>\s*\);\s*\}\)\(\)\}/g;

const matches = content.match(regex);
console.log("Matches:", matches ? matches.length : 0);

if(matches && matches.length === 2) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log("Replaced successfully.");
}


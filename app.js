const dropArea = document.getElementById('drop-area');
const imageInput = document.getElementById('image-input');
const optimizeButton = document.getElementById('optimize-button');
const downloadButton = document.getElementById('download-button');
const targetSizeSelect = document.getElementById('target-size');
const customKBInput = document.getElementById('custom-kb');
const customTargetInputDiv = document.querySelector('.custom-target-input');

const originalPreview = document.getElementById('original-preview');
const compressedPreview = document.getElementById('compressed-preview');
const originalSizeText = document.getElementById('original-size');
const compressedSizeText = document.getElementById('compressed-size');
const statusMessage = document.getElementById('status-message');

const themeToggle = document.getElementById('theme-toggle');

let currentFile = null;
let compressedBlob = null;

/* ===========================
   IMAGE COMPRESSION CORE
=========================== */

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = reject;
        img.src = url;
    });
}

function canvasToBlob(img, width, height, quality) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = width;
        canvas.height = height;

        try {
            ctx.drawImage(img, 0, 0, width, height);
        } catch (err) {
            reject(err);
            return;
        }

        canvas.toBlob(
            blob => {
                if (blob) resolve(blob);
                else reject(new Error("Failed to generate image."));
            },
            "image/jpeg",
            quality
        );
    });
}

async function compressImageToTargetKB(file, targetKB) {

    const img = await loadImage(file);

    let bestBlob = null;
    let bestSize = 0;

    let low = 0.05;
    let high = 0.95;

    for (let i = 0; i < 20; i++) {

        const quality = (low + high) / 2;

        const blob = await canvasToBlob(
            img,
            img.width,
            img.height,
            quality
        );

        const sizeKB = blob.size / 1024;

        if (sizeKB <= targetKB && sizeKB > bestSize) {
            bestBlob = blob;
            bestSize = sizeKB;
        }

        if (sizeKB > targetKB) {
            high = quality;
        } else {
            low = quality;
        }
    }

    return bestBlob;
}

/* ===========================
   UI HELPERS
=========================== */

function formatBytes(bytes) {
    if (!bytes) return "";

    if (bytes < 1024) {
        return bytes + " Bytes";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function showPreview(imgElement, fileOrBlob) {
    const url = URL.createObjectURL(fileOrBlob);

    imgElement.src = url;
    imgElement.style.display = "block";

    imgElement.onload = () => {
        URL.revokeObjectURL(url);
    };
}

function resetResults() {
    compressedBlob = null;

    compressedPreview.style.display = "none";
    compressedSizeText.textContent = "";

    statusMessage.textContent = "";

    downloadButton.style.display = "none";
}

function setFile(file) {
    currentFile = file;

    resetResults();

    showPreview(originalPreview, file);

    originalSizeText.textContent =
        "Original Size: " + formatBytes(file.size);

    optimizeButton.disabled = false;
}

/* ===========================
   FILE INPUT
=========================== */

imageInput.addEventListener("change", e => {

    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent =
            "Please select a valid image.";
        statusMessage.className = "error";
        return;
    }

    setFile(file);
});

/* ===========================
   DRAG & DROP
=========================== */

dropArea.addEventListener("dragover", e => {
    e.preventDefault();
    dropArea.classList.add("highlight");
});

dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("highlight");
});

dropArea.addEventListener("drop", e => {

    e.preventDefault();

    dropArea.classList.remove("highlight");

    const file = e.dataTransfer.files[0];

    if (!file || !file.type.startsWith("image/")) {
        return;
    }

    setFile(file);
});

/* ===========================
   CUSTOM KB FIELD
=========================== */

targetSizeSelect.addEventListener("change", () => {

    if (targetSizeSelect.value === "custom") {
        customTargetInputDiv.style.display = "block";
    } else {
        customTargetInputDiv.style.display = "none";
    }
});

/* ===========================
   OPTIMIZE
=========================== */

optimizeButton.addEventListener("click", async () => {

    if (!currentFile) {
        return;
    }

    let targetKB;

    if (targetSizeSelect.value === "custom") {

        targetKB = parseFloat(customKBInput.value);

        if (isNaN(targetKB) || targetKB <= 0) {

            statusMessage.textContent =
                "Please enter a valid target size.";

            statusMessage.className = "error";
            return;
        }

    } else {

        targetKB = parseFloat(targetSizeSelect.value);
    }

    optimizeButton.disabled = true;
    statusMessage.className = "";
    statusMessage.textContent =
        "Compressing image...";

    try {

        compressedBlob =
            await compressImageToTargetKB(
                currentFile,
                targetKB
            );

        if (!compressedBlob) {

            statusMessage.textContent =
                "Unable to reach target size.";

            statusMessage.className = "error";

            optimizeButton.disabled = false;
            return;
        }

        showPreview(
            compressedPreview,
            compressedBlob
        );

        compressedSizeText.textContent =
            "Compressed Size: " +
            formatBytes(compressedBlob.size);

        statusMessage.textContent =
            `Success! Target: ${targetKB} KB | Result: ${(compressedBlob.size / 1024).toFixed(1)} KB`;

        statusMessage.className = "success";

        downloadButton.style.display =
            "inline-block";

    } catch (err) {

        console.error(err);

        statusMessage.textContent =
            "Compression failed.";

        statusMessage.className = "error";

    } finally {

        optimizeButton.disabled = false;
    }
});

/* ===========================
   DOWNLOAD
=========================== */

downloadButton.addEventListener("click", () => {

    if (!compressedBlob) return;

    const url =
        URL.createObjectURL(compressedBlob);

    const a = document.createElement("a");

    a.href = url;
    a.download =
        "compressed_" + currentFile.name;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
});

/* ===========================
   THEME TOGGLE
=========================== */

function applyTheme(isDark) {

    document.body.classList.toggle(
        "dark-theme",
        isDark
    );

    themeToggle.textContent =
        isDark ? "Light" : "Dark";

    localStorage.setItem(
        "theme",
        isDark ? "dark" : "light"
    );
}

themeToggle.addEventListener("click", () => {

    const isDark =
        document.body.classList.contains(
            "dark-theme"
        );

    applyTheme(!isDark);
});

(function initTheme() {

    const savedTheme =
        localStorage.getItem("theme");

    if (savedTheme === "dark") {
        applyTheme(true);
    } else {
        applyTheme(false);
    }
})();
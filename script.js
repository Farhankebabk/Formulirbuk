const form = document.querySelector("#registrationForm");
form.hidden = false;
document.querySelector("#scriptLoadNotice").hidden = true;

const formMessage = document.querySelector("#formMessage");

const successDialog = document.querySelector("#successDialog");
const successSummary = document.querySelector("#successSummary");
const closeDialogButton = document.querySelector("#closeDialog");
const printSummaryButton = document.querySelector("#printSummary");

const routeGuidance = document.querySelector("#routeGuidance");
const receipt = document.querySelector("#printReceipt");
const receiptDetails = document.querySelector("#receiptDetails");

const fileInputs = [...document.querySelectorAll('.doc-field input[type="file"]')];
const previewUrls = new Map();
const checkTokens = new Map();
const pendingFileChecks = new Map();

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_LABEL = "5 MB";

let submittedData = null;
let isSubmitting = false;


/* Jalur nasional ditampilkan sebagai panduan umum, bukan pengganti juknis daerah. */
const routeDescriptions = {
    Domisili: "Jalur Domisili ditujukan bagi calon murid yang berdomisili dalam wilayah penerimaan yang ditetapkan pemerintah daerah. Bukti dan ketentuan domisili mengikuti juknis daerah.",
    Afirmasi: "Jalur Afirmasi ditujukan bagi calon murid dari keluarga ekonomi tidak mampu dan/atau penyandang disabilitas. Dokumen pendukung ditentukan dalam juknis daerah.",
    Prestasi: "Jalur Prestasi dapat mempertimbangkan prestasi akademik dan/atau nonakademik. Contoh bukti dapat berupa rapor, surat keterangan peringkat, sertifikat, atau piagam sesuai juknis daerah.",
    Mutasi: "Jalur Mutasi ditujukan bagi calon murid yang pindah domisili karena tugas orang tua/wali atau anak guru yang mendaftar di satuan pendidikan tempat orang tua mengajar. Dokumen penugasan dan domisili mengikuti juknis daerah."
};


/* Generate a clear validation message for each type of invalid field. */
function getFieldMessage(field) {
    const validity = field.validity;

    if (validity.valueMissing) {
        if (field.type === "radio") {
            return "Pilih salah satu pilihan.";
        }

        if (field.tagName === "SELECT") {
            return "Pilih salah satu opsi.";
        }

        return "Kolom ini wajib diisi.";
    }

    if (validity.patternMismatch) {
        if (field.id === "nisn") {
            return "NISN harus terdiri dari tepat 10 angka.";
        }

        return "Gunakan nomor Indonesia, misalnya 081234567890 atau +62 812-3456-7890.";
    }

    if (validity.rangeUnderflow || validity.rangeOverflow) {
        return "Tahun lulus berada di luar rentang yang diizinkan.";
    }

    if (validity.typeMismatch) {
        return "Periksa kembali format data yang dimasukkan.";
    }

    if (validity.customError) {
        return field.validationMessage;
    }

    return "Periksa kembali kolom ini.";
}


/* Return a validation target; radio buttons are treated as one group. */
function getValidationTargets() {
    const targets = [];
    const seenRadioGroups = new Set();

    for (const field of form.elements) {
        if (!field.willValidate || field.disabled) {
            continue;
        }

        if (field.type === "radio") {
            if (seenRadioGroups.has(field.name)) {
                continue;
            }

            seenRadioGroups.add(field.name);
            targets.push({
                control: field,
                controls: [...form.querySelectorAll(`input[type="radio"][name="${field.name}"]`)],
                container: field.closest("fieldset"),
                error: field.closest("fieldset")?.querySelector(".field-error")
            });
            continue;
        }

        const container = field.closest(".field, .doc-field");

        targets.push({
            control: field,
            controls: [field],
            container,
            error: container?.querySelector(".field-error")
        });
    }

    return targets;
}


/* Show or clear the inline error associated with one field or radio group. */
function updateTargetError(target) {
    const invalidControl = target.controls.find((field) => !field.validity.valid);

    if (!invalidControl) {
        target.controls.forEach((field) => field.removeAttribute("aria-invalid"));
        if (target.error) {
            target.error.textContent = "";
            target.error.hidden = true;
        }
        return null;
    }

    const message = getFieldMessage(invalidControl);

    target.controls.forEach((field) => field.setAttribute("aria-invalid", "true"));

    if (target.error) {
        target.error.textContent = message;
        target.error.hidden = false;
    }

    return message;
}


/* Validate all fields and list exactly which fields need attention. */
function validateForm() {
    const invalidLabels = [];
    const targets = getValidationTargets();

    for (const target of targets) {
        const message = updateTargetError(target);

        if (message) {
            const label = target.container?.querySelector("label, legend")?.textContent
                ?.replace("*", "")
                .trim() || "Pilihan formulir";

            invalidLabels.push(label);
        }
    }

    if (invalidLabels.length > 0) {
        const list = document.createElement("ul");

        invalidLabels.forEach((label) => {
            const item = document.createElement("li");
            item.textContent = label;
            list.appendChild(item);
        });

        formMessage.replaceChildren(
            document.createTextNode(`Ada ${invalidLabels.length} bagian yang perlu diperbaiki:`),
            list
        );
        formMessage.hidden = false;

        const firstInvalid = form.querySelector('[aria-invalid="true"]');
        firstInvalid?.focus();

        return false;
    }

    formMessage.hidden = true;
    formMessage.replaceChildren();
    return true;
}


/* Remove an object URL when its file preview is replaced or removed. */
function releasePreview(input) {
    const previewUrl = previewUrls.get(input.id);

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrls.delete(input.id);
    }
}


function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}


/* Identify common file formats from their file signatures, not just file names. */
async function detectFileKind(file) {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const startsWith = (...signature) => signature.every((byte, index) => bytes[index] === byte);

    if (startsWith(0xff, 0xd8, 0xff)) {
        return "image";
    }

    if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
        return "image";
    }

    if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) {
        return "pdf";
    }

    const isWebp = startsWith(0x52, 0x49, 0x46, 0x46) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50;

    return isWebp ? "image" : null;
}


function canDecodeImage(url) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
    });
}


function showUploadError(input, message) {
    const result = document.querySelector(`#${input.id}-result`);
    const fieldError = document.querySelector(`#${input.id}-error`);
    const error = document.createElement("p");

    error.className = "doc-error";
    error.textContent = message;

    result.replaceChildren(error);
    fieldError.textContent = message;
    fieldError.hidden = false;

    input.setAttribute("aria-invalid", "true");
    input.setCustomValidity(message);
    releasePreview(input);
}


function clearUploadError(input) {
    const fieldError = document.querySelector(`#${input.id}-error`);

    input.removeAttribute("aria-invalid");
    input.setCustomValidity("");
    fieldError.textContent = "";
    fieldError.hidden = true;
}


function findDuplicateFile(input, file) {
    for (const otherInput of fileInputs) {
        const otherFile = otherInput.files[0];

        if (
            otherInput !== input &&
            otherFile &&
            otherFile.name === file.name &&
            otherFile.size === file.size &&
            otherFile.lastModified === file.lastModified
        ) {
            return otherInput.closest(".doc-field").dataset.label;
        }
    }

    return null;
}


function showUploadPreview(input, file, kind, previewUrl) {
    const field = input.closest(".doc-field");
    const result = document.querySelector(`#${input.id}-result`);

    const preview = document.createElement("div");
    preview.className = "doc-preview";

    const thumbnail = document.createElement("div");
    thumbnail.className = "doc-thumb";

    if (kind === "image") {
        const image = document.createElement("img");
        image.src = previewUrl;
        image.alt = `Pratinjau ${field.dataset.label}`;
        thumbnail.appendChild(image);
    } else {
        thumbnail.textContent = "PDF";
    }

    const metadata = document.createElement("div");
    metadata.className = "doc-meta";

    const fileName = document.createElement("p");
    fileName.className = "doc-name";
    fileName.textContent = file.name;

    const fileSize = document.createElement("p");
    fileSize.className = "doc-size";
    fileSize.textContent = `${formatFileSize(file.size)}. Berkas tersedia di perangkat ini.`;

    metadata.append(fileName, fileSize);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary-button doc-remove";
    removeButton.textContent = "Hapus berkas";
    removeButton.setAttribute("aria-label", `Hapus berkas ${field.dataset.label}`);

    removeButton.addEventListener("click", () => {
        input.value = "";
        clearUploadError(input);
        result.replaceChildren();
        releasePreview(input);
        input.focus();
    });

    preview.append(thumbnail, metadata, removeButton);
    result.replaceChildren(preview);
}


async function handleFileChange(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    const documentLabel = input.closest(".doc-field").dataset.label;
    const token = (checkTokens.get(input.id) || 0) + 1;

    checkTokens.set(input.id, token);
    clearUploadError(input);
    releasePreview(input);

    const result = document.querySelector(`#${input.id}-result`);

    if (!file) {
        result.replaceChildren();
        return;
    }

    if (file.size === 0) {
        showUploadError(input, "Berkas kosong. Pilih berkas lain.");
        return;
    }

    if (file.size > MAX_FILE_BYTES) {
        showUploadError(
            input,
            `Ukuran berkas ${formatFileSize(file.size)} melebihi batas ${MAX_FILE_LABEL}.`
        );
        return;
    }

    const fileKind = await detectFileKind(file);

    if (checkTokens.get(input.id) !== token) {
        return;
    }

    if (!fileKind) {
        showUploadError(input, "Format tidak dikenali. Gunakan JPG, PNG, WebP, atau PDF.");
        return;
    }

    const duplicateLabel = findDuplicateFile(input, file);

    if (duplicateLabel) {
        showUploadError(input, `Berkas ini sama dengan unggahan ${duplicateLabel}.`);
        return;
    }

    const previewUrl = URL.createObjectURL(file);

    if (fileKind === "image" && !(await canDecodeImage(previewUrl))) {
        URL.revokeObjectURL(previewUrl);
        showUploadError(input, "Gambar tidak dapat dibaca. Pilih berkas gambar lain.");
        return;
    }

    if (checkTokens.get(input.id) !== token) {
        URL.revokeObjectURL(previewUrl);
        return;
    }

    previewUrls.set(input.id, previewUrl);
    showUploadPreview(input, file, fileKind, previewUrl);
}


fileInputs.forEach((input) => {
    input.addEventListener("change", () => {
        const task = handleFileChange({ currentTarget: input });
        pendingFileChecks.set(input.id, task);

        task.finally(() => {
            if (pendingFileChecks.get(input.id) === task) {
                pendingFileChecks.delete(input.id);
            }
        });
    });
});


/* Update path-specific guidance without claiming to replace regional rules. */
form.querySelectorAll('input[name="registrationRoute"]').forEach((radio) => {
    radio.addEventListener("change", () => {
        routeGuidance.replaceChildren();

        const heading = document.createElement("strong");
        heading.textContent = `Gambaran jalur ${radio.value}`;

        const description = document.createElement("p");
        description.textContent = routeDescriptions[radio.value];

        const note = document.createElement("p");
        note.textContent = "Periksa juknis Provinsi Sumatera Selatan untuk persyaratan yang berlaku.";

        routeGuidance.append(heading, description, note);
    });
});


/* Clear an inline error as soon as the user edits the associated control. */
form.addEventListener("input", (event) => {
    if (event.target.type === "file" || event.target.type === "radio") {
        return;
    }

    const target = getValidationTargets().find((item) => item.controls.includes(event.target));

    if (target) {
        updateTargetError(target);
    }

    if ([...form.querySelectorAll('[aria-invalid="true"]')].length === 0) {
        formMessage.hidden = true;
    }
});

form.addEventListener("change", (event) => {
    if (event.target.type !== "radio") {
        return;
    }

    const target = getValidationTargets().find((item) => item.controls.includes(event.target));

    if (target) {
        updateTargetError(target);
    }

    if ([...form.querySelectorAll('[aria-invalid="true"]')].length === 0) {
        formMessage.hidden = true;
    }
});


/* Build only the small, printable summary needed by the applicant. */
function buildPrintReceipt(data) {
    receiptDetails.replaceChildren();

    const rows = [
        ["Nama calon murid", data.studentName],
        ["NISN", data.nisn],
        ["Asal sekolah", data.previousSchool],
        ["Jalur pilihan", data.registrationRoute],
        ["Waktu pemeriksaan", new Date(data.checkedAt).toLocaleString("id-ID")]
    ];

    rows.forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;

        const description = document.createElement("dd");
        description.textContent = value;

        receiptDetails.append(term, description);
    });
}


function collectFormData() {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.checkedAt = new Date().toISOString();

    return data;
}


form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    isSubmitting = true;
    formMessage.hidden = true;

    try {
        await Promise.all(pendingFileChecks.values());

        if (!validateForm()) {
            return;
        }

        submittedData = collectFormData();
        buildPrintReceipt(submittedData);

        successSummary.textContent =
            `Data atas nama ${submittedData.studentName} telah lolos pemeriksaan format di browser. ` +
            "Belum ada pendaftaran yang dikirim atau disimpan oleh sekolah.";

        successDialog.showModal();
    } finally {
        isSubmitting = false;
    }
});


closeDialogButton.addEventListener("click", () => {
    successDialog.close();
});


printSummaryButton.addEventListener("click", () => {
    if (!submittedData) {
        return;
    }

    successDialog.close();
    document.body.classList.add("print-mode");
    window.print();
    document.body.classList.remove("print-mode");
});


/* Use the device's local calendar date, not UTC, for the date limit. */
const birthDateInput = document.querySelector("#birthDate");
const today = new Date();
const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
].join("-");

birthDateInput.max = localToday;


/* Keep graduation years near the current admission period. */
const graduationYearInput = document.querySelector("#graduationYear");
graduationYearInput.min = String(today.getFullYear() - 1);
graduationYearInput.max = String(today.getFullYear() + 1);


window.addEventListener("pagehide", () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.clear();
});

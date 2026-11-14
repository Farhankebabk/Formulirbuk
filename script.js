const form = document.querySelector("#registrationForm");
const formMessage = document.querySelector("#formMessage");

const successDialog = document.querySelector("#successDialog");
const successSummary = document.querySelector("#successSummary");

const closeDialogButton = document.querySelector("#closeDialog");
const downloadDataButton = document.querySelector("#downloadData");

let submittedData = null;


/* Collect all form fields into one plain object. */
function collectFormData() {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.submittedAt = new Date().toISOString();

    return data;
}


/* Display a validation message and focus the first invalid field. */
function showValidationMessage() {
    formMessage.textContent =
        "Masih ada data yang belum lengkap atau formatnya belum benar. " +
        "Periksa kembali kolom yang ditandai.";

    formMessage.hidden = false;

    const firstInvalidField = form.querySelector(":invalid");

    if (firstInvalidField) {
        firstInvalidField.focus();
    }
}


/* Handle form submission. This version does not send data to a server. */
form.addEventListener("submit", function (event) {
    event.preventDefault();

    formMessage.hidden = true;

    if (!form.reportValidity()) {
        showValidationMessage();
        return;
    }

    submittedData = collectFormData();

    successSummary.textContent =
        `Formulir atas nama ${submittedData.studentName} ` +
        "telah lolos pemeriksaan di browser. " +
        "Data belum dikirim ke server sekolah.";

    successDialog.showModal();
});


/* Close the confirmation dialog. */
closeDialogButton.addEventListener("click", function () {
    successDialog.close();
});


/* Export the validated form data as a JSON file. */
downloadDataButton.addEventListener("click", function () {
    if (!submittedData) {
        return;
    }

    const jsonData = JSON.stringify(submittedData, null, 4);

    const fileBlob = new Blob([jsonData], {
        type: "application/json"
    });

    const fileUrl = URL.createObjectURL(fileBlob);

    const downloadLink = document.createElement("a");

    const safeName = (submittedData.studentName || "siswa")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

    downloadLink.href = fileUrl;
    downloadLink.download = `pendaftaran-${safeName}.json`;

    document.body.appendChild(downloadLink);

    downloadLink.click();
    downloadLink.remove();

    URL.revokeObjectURL(fileUrl);
});


/* Prevent selecting a future birth date. */
const birthDateInput = document.querySelector("#birthDate");

birthDateInput.max = new Date().toISOString().split("T")[0];


/* Apply the theme based on the operating system preference. */
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function applySystemTheme(event) {
    document.documentElement.dataset.theme = event.matches
        ? "dark"
        : "light";
}

applySystemTheme(systemTheme);

systemTheme.addEventListener?.("change", applySystemTheme);

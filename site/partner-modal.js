export function openPartnerModal(opener) {
  let dialog = document.querySelector("#partner-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "partner-dialog";
    dialog.setAttribute("aria-labelledby", "partner-title");
    const content = document.createElement("div"); content.className = "dlg";
    const heading = document.createElement("h2"); heading.id = "partner-title"; heading.textContent = "Sponsor a thoughtful gift";
    const description = document.createElement("p");
    description.textContent = "UK brands and independent Etsy sellers can enquire about a clearly labelled Sponsored Pick for the Q4 gift season. We match one relevant partner slot to interests and budget, alongside organic ideas. Paid placements never buy an endorsement or a guarantee of sales.";
    const details = document.createElement("p");
    details.textContent = "Include your shop URL, product details, UK delivery coverage, proposed dates and budget. Inventory is reviewed before publication. We do not collect enquiries through a website form.";
    const email = document.createElement("a"); email.className = "btn btn-primary";
    email.href = "mailto:support@christmasidea.co.uk?subject=Q4%20gift%20sponsorship%20enquiry"; email.textContent = "Enquire by email";
    const notice = document.createElement("p"); notice.className = "source";
    notice.textContent = "This opens your email app. If you send an enquiry, it becomes ordinary email correspondence, not website marketing data.";
    const close = document.createElement("button"); close.type = "button"; close.className = "btn btn-outline"; close.textContent = "Close";
    close.addEventListener("click", () => dialog.close());
    content.append(heading, description, details, email, notice, close);
    dialog.append(content); document.body.append(dialog);
  }
  dialog.addEventListener("close", () => opener?.focus(), { once: true });
  dialog.showModal();
}

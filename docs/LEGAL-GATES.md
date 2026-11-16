# Safety and legal readiness gates

This repository is a public prototype, not a licensed travel agency or completed reservation service. Bosphorly's intended model is a referral intermediary: licensed companies sell, deliver and collect payment; Bosphorly earns a commission from them (see [BUSINESS-MODEL.md](BUSINESS-MODEL.md)).

Before forwarding real traveler requests, obtain professional Turkish legal and regulatory review of:

- whether the referral model needs Bosphorly's own travel agency certificate under Law 1618, or should run under a partner A-group agency;
- how the traveler is told that the contract and payment are with the company, and who handles complaints about the service;
- commission invoicing and the tax treatment of hotel shares;
- KVKK: the privacy notice must name the companies that receive the traveler's details and why;
- applicable cancellation terms per service.

Collecting payments on Bosphorly (becoming merchant of record) is outside the current model and requires its own legal, licensing and PSP review.

Never treat an unqualified non-refundable statement as a universal rule. Set service-specific cancellation windows, legal exceptions, supplier obligations and dispute handling transparently.

Do not collect passport scans, full card numbers, personal health information or unnecessary nationality fields in a static prototype. Use an established PCI-compliant hosted payment flow for production. Disallow secrets/keys and actual passenger records in this repository.

Do not claim an operator is partnered, available, licensed, or currently offering a stated fare without current verification and agreement.

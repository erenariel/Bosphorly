const transferFields = [
  ['first', 'Ad', 'First name'], ['last', 'Soyad', 'Last name'],
  ['nationality', 'Uyruk', 'Nationality'], ['gender', 'Cinsiyet', 'Gender'],
  ['passport', 'Pasaport numarası', 'Passport number']
];
function updatePassengerFields() {
  const area = document.getElementById('passengerList');
  const count = Number(document.getElementById('passengers').value);
  if (!Number.isInteger(count) || count < 1 || count > 16) return;
  const tr = document.documentElement.lang === 'tr';
  while (area.children.length > count) area.lastElementChild.remove();
  for (let i = 0; i < count; i++) {
    let row = area.children[i];
    if (!row) {
      row = document.createElement('fieldset');
      row.className = 'form-grid';
      row.append(document.createElement('legend'));
      for (const [key] of transferFields) {
        const label = document.createElement('label');
        label.className = 'field';
        const input = document.createElement('input');
        input.dataset.key = key;
        input.required = true;
        input.maxLength = key === 'passport' ? 30 : 60;
        input.autocomplete = 'off';
        label.append(document.createElement('span'), input);
        row.append(label);
      }
      area.append(row);
    }
    row.firstChild.textContent = (tr ? 'Yolcu ' : 'Passenger ') + (i + 1);
    transferFields.forEach(([,turkish,english], j) => {
      row.children[j + 1].firstChild.textContent = tr ? turkish : english;
    });
  }
}
function passengerManifest() {
  return Array.from(document.querySelectorAll('#passengerList fieldset'), row =>
    [row.firstChild.textContent, ...Array.from(row.querySelectorAll('label'), label =>
      label.firstChild.textContent + ': ' + label.lastChild.value.trim())].join('\n')
  ).join('\n\n');
}

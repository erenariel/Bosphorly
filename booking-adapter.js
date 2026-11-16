/* Pure local adapter. No network, persistence, credentials or customer fields. */
window.BosphorlyBooking = Object.freeze({
 preview({experienceId,date,guests}) {
  return {state:'draft',experienceId,date,guests,reservationConfirmed:false,submitted:false};
 }
});

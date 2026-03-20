function showTab(tabName){
  document.getElementById("breakdown").style.display = "none";
  document.getElementById("pm").style.display = "none";
  document.getElementById("equipment").style.display = "none";
  document.getElementById("spares").style.display = "none";

  document.getElementById(tabName).style.display = "block";
}
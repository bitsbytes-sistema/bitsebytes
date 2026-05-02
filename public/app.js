let tickets = [];

async function load(){
  const res = await fetch("/api/tickets");
  tickets = await res.json();
  render();
}

async function create(){
  await fetch("/api/tickets",{
    method:"POST",
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      cliente:cliente.value,
      equipamento:equipamento.value
    })
  });

  cliente.value="";
  equipamento.value="";

  load();
}

function render(){
  const div = document.getElementById("list");
  div.innerHTML="";

  tickets.forEach(t=>{
    div.innerHTML += `
      <div class="card">
        <b>${t.cliente}</b><br>
        ${t.equipamento}<br>
        ${t.status}
      </div>
    `;
  });
}

load();
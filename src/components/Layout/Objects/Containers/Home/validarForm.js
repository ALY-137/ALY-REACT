export function validarFormulario() {
    var campoTextarea = document.getElementById("help");
    var campoSelect = document.getElementById("helpMens");
    var mensagemErro = document.getElementById("mensagemErro");
    var emailCampo = document.getElementById("emailCamp");

    const userId = localStorage.getItem('userId'); // USUARIO LOGADO

    if (!userId) {
        if (emailCampo.value.trim() === "") {
            mensagemErro.textContent = "⚠ Hey, você ainda não disse o seu e-mail!";
            return(0)
        } else {
            mensagemErro.textContent = ""; // Limpa a mensagem de erro
        }
    }
        if (campoTextarea.value.trim() === "" && campoSelect.value === "") {
            mensagemErro.textContent = "⚠ Hey, você ainda não disse o assunto!";
            return(0)
        } else {
            mensagemErro.textContent = ""; // Limpa a mensagem de erro
            // Lógica para lidar com o formulário válido
        
            return(1)
        }
        
    

}


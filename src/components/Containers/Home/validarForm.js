export function validarFormulario() {
    var campoTextarea = document.getElementById("help");
    var campoSelect = document.getElementById("helpMens");
    var mensagemErro = document.getElementById("mensagemErro");

    if (campoTextarea.value.trim() === "" && campoSelect.value === "") {
        mensagemErro.textContent = "⚠ Por favor, preencha um campo!";
        return(0)
    } else {
        mensagemErro.textContent = ""; // Limpa a mensagem de erro
        // Lógica para lidar com o formulário válido
       
        return(1)
    }
}

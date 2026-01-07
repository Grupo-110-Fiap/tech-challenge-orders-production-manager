# Branch Protection Rules

Para garantir a qualidade do código e a segurança do deploy, configure as seguintes regras de proteção para a branch `main` no repositório do GitHub:

1.  **Require a pull request before merging**
    *   Marque esta opção para impedir commits diretos na `main`.
    *   **Require approvals**: 1 (ou mais, conforme a política do time).

2.  **Require status checks to pass before merging**
    *   Marque esta opção.
    *   Procure e selecione os checks definidos no CI:
        *   `build`
        *   `Run Unit Tests`
        *   `Run BDD Tests`

3.  **Do not allow bypassing the above settings**
    *   Recomendado para administradores também seguirem as regras.

## Como configurar
1.  Vá até a aba **Settings** do repositório no GitHub.
2.  No menu lateral, clique em **Branches**.
3.  Clique em **Add branch protection rule**.
4.  Em **Branch name pattern**, digite `main`.
5.  Selecione as opções listadas acima.
6.  Clique em **Create**.

describe('Home page', function() {
  it('Visits the home page', function() {
    cy.visit('/')
  })
})

describe('Log in as admin', function() {
  it('Goes to login page, logs in with default creds, and should redirect to index', function() {
    cy.visit('/auth/?next=/index.htm')

    cy.get('.input-group > input[name="username"].form-control').type(`admin{enter}`)
    cy.get('.input-group > input[name="password"].form-control').type(`admin{enter}`)

    cy.url().should("include", "/index.htm")  // redirected back to home page
  })
})

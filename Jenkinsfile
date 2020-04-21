podTemplate(label: 'erc20-transfers-exporter', containers: [
  containerTemplate(name: 'docker', image: 'docker', ttyEnabled: true, command: 'cat', envVars: [
    envVar(key: 'DOCKER_HOST', value: 'tcp://docker-host-docker-host:2375')
  ])
]) {
  node('erc20-transfers-exporter') {
    stage('Run Tests') {
      container('docker') {
        def scmVars = checkout scm

        sh "docker build --build-arg NODE_ENV=development -t erc20-transfers-exporter-test:${scmVars.GIT_COMMIT} ."
        sh "docker run --rm -t erc20-transfers-exporter-test:${scmVars.GIT_COMMIT} npm test"

        withCredentials([
          string(
            credentialsId: 'aws_account_id',
            variable: 'aws_account_id'
          )
        ]) {
          def awsRegistry = "${env.aws_account_id}.dkr.ecr.eu-central-1.amazonaws.com"
          docker.withRegistry("https://${awsRegistry}", "ecr:eu-central-1:ecr-credentials") {
              sh "docker build -t ${awsRegistry}/erc20-transfers-exporter:${env.BRANCH_NAME} -t ${awsRegistry}/erc20-transfers-exporter:${scmVars.GIT_COMMIT} ."
              sh "docker push ${awsRegistry}/erc20-transfers-exporter:${env.BRANCH_NAME}"
              sh "docker push ${awsRegistry}/erc20-transfers-exporter:${scmVars.GIT_COMMIT}"
            }
        }
      }
    }
  }
}

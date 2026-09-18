# Welcome to the Arches Project!

Arches is a new, open-source, web-based, geospatial information system for cultural heritage inventory and management. Arches is purpose-built for the international cultural heritage field, and it is designed to record all types of immovable heritage, including archaeological sites, buildings and other historic structures, landscapes, and heritage ensembles or districts.

Please see the [project page](http://archesproject.org/) for more information on the Arches project.

The Arches Installation Guide and Arches User Guide are available [here](http://archesproject.org/documentation/).

# Catalina
catalina is a demo instance of arches for HER v8.1

# Getting Started
Follow the below instructions for how to get this instance of arches running using the Flax and Teal Arches Container Toolkit which will run the instance within Docker

## Prerequistes

Docker version: 
Docker Compose version:

## Installation

1. First create a directory for you project and navigate into it
```
mkdir catalina && cd catalina
```

2. Clone the repo
```
git clone 
```

3. Create a venv for the project, this is mainly for the initial set up of arches
```
python3 -m venv ENV
```

4. Activate the virtual environment
```
source ENV/bin/activate
```

You can check it has activate by checking
```
which python
```
You should see a path to the dir you just created

5. Navigate to the repo and intialise the submodules (arches container toolkit)
```
cd catalina &&
git submodule update --init --recursive
```

6. Build arches
```
cd catalina && 
make build
```
This will navigate to the folder that contains the make file and run the build command

## CI/CD

Pull requests trigger lint and unit test checks defined in
`.github/workflows/main.yml`, running on GitHub-hosted runners.

The image build and deploy to the cluster (the self-hosted, docker-build,
Flux-driven pipeline) lives in the private `catalina-fluxcd` repo, as
`.github/workflows/build-arches.yml`. It's triggered manually
(workflow_dispatch) from that repo and always builds this repo's `main`
branch. If you need a new image built and shipped, ask someone with access
to `catalina-fluxcd` to run it, or run it yourself from the Actions tab
there.


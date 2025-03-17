FROM public.ecr.aws/docker/library/ruby:3.3.6-slim-bookworm

ENV LANG=C.UTF-8
ENV TZ=Asia/Tokyo

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential default-mysql-client default-libmysqlclient-dev git \
    && apt-get clean

FROM public.ecr.aws/docker/library/ruby:3.3.6-slim-bookworm

ENV LANG=C.UTF-8
ENV RAILS_ENV=production
ENV TZ=Asia/Tokyo

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    default-mysql-client \
    default-libmysqlclient-dev \
    nodejs \
    vim \
    git \
    libyaml-dev \
    libjemalloc2

COPY Gemfile /usr/src/app
COPY Gemfile.lock /usr/src/app
RUN bundle install
RUN RAILS_ENV=production bundle exec rails assets:precompile --trace
COPY . /usr/src/app

CMD ["bundle", "exec", "rails", "-v"]

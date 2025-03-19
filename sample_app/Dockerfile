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
COPY . /usr/src/app

RUN ls -la
RUN if [ -z "$SECRET_KEY_BASE" ]; then \
    echo "SECRET_KEY_BASE environment variable is not set" && exit 1; \
fi

RUN bundle exec rails assets:precompile RAILS_ENV=production

CMD ["bundle", "exec", "rails", "-v"]

#/bin/bash

# install apache
yum install -y httpd

# setup PHP
amazon-linux-extras install -y php8.1

# setup apache and permissions
usermod -a -G apache ec2-user
chown -R ec2-user:apache /var/www
chmod 2775 /var/www
find /var/www -type d -exec sudo chmod 2775 {} \;
find /var/www -type f -exec sudo chmod 0664 {} \;

yum install -y jq
yum install -y mod_ssl
yum install -y php-dom
yum install -y php-gd
yum install -y php-mbstring

# make replacements to httpd.conf
sed -i -e "s/ServerAdmin root@localhost/ServerAdmin ${ADMIN_EMAIL}/g" /etc/httpd/conf/httpd.conf

# make replacements to php.ini
sed -i -e "s/short_open_tag = Off/short_open_tag = On/g" /etc/php.ini

# copy website conf
cp ../conf/website-${ENV_NAME}-site.f3rva.org.conf /etc/httpd/conf.d
cp ../conf/website-${ENV_NAME}-bd.f3rva.org.conf /etc/httpd/conf.d

# setup SSL

# start apache and setup as a service
systemctl start httpd
systemctl enable httpd


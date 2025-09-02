#/bin/bash

# install software package dependencies
echo "installing httpd and php yum packages"
yum install -y httpd mod_ssl wget php-fpm php-mysqli php-json php php-devel php-gd
#yum install -y jq
#yum install -y mod_ssl
#yum install -y php-dom
#yum install -y php-gd
#yum install -y php-mbstring


# setup PHP
#amazon-linux-extras install -y php8.1

# setup apache and permissions
echo "setting apache permissions to ec2-user"
usermod -a -G apache ec2-user
chown -R ec2-user:apache /var/www
chmod 2775 /var/www
find /var/www -type d -exec sudo chmod 2775 {} \;
find /var/www -type f -exec sudo chmod 0664 {} \;
chmod 755 /var/log/httpd

# make replacements to httpd.conf
echo "replacing httpd.conf settings"
sed -i -e "s/ServerAdmin root@localhost/ServerAdmin ${ADMIN_EMAIL}/g" /etc/httpd/conf/httpd.conf

# make replacements to php.ini
echo "setting php.ini settings"
sed -i -e "s/short_open_tag = Off/short_open_tag = On/g" /etc/php.ini

# copy website conf
echo "copying website conf files"
cp ../conf/000-default.f3rva.org.conf /etc/httpd/conf.d
cp ../conf/website-${ENV_NAME}-site.f3rva.org.conf /etc/httpd/conf.d
cp ../conf/website-${ENV_NAME}-bd.f3rva.org.conf /etc/httpd/conf.d

# setup SSL

# start apache and setup as a service
systemctl start httpd
systemctl enable httpd

echo "setup httpd complete"


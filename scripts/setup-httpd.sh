#/bin/bash

# install apache and setup as a service
yum install -y httpd
systemctl start httpd
systemctl enable httpd

# setup PHP
amazon-linux-extras install -y php8.1

# setup apache and permissions
usermod -a -G apache ec2-user
chown -R ec2-user:apache /var/www
chmod 2775 /var/www
find /var/www -type d -exec sudo chmod 2775 {} \;
find /var/www -type f -exec sudo chmod 0664 {} \;

#yum install composer
yum install php-dom
yum install php-mbstring

systemctl restart httpd

# make replacements to httpd.conf
sed -i -e 's/ServerAdmin root@localhost/ServerAdmin admin@f3rva.org/g' /etc/httpd/conf/httpd.conf

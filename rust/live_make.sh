while [ 1 ]; do
    if make -q; then
        sleep 1;
    else
        clear; 
        make && ./compiler test
        make -t
    fi;
done;
